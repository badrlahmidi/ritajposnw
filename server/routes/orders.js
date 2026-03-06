const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit, saveDb } = require('../db');
const v = require('../validators');
const facture = require('../facture');

// Lister les commandes
router.get('/', authMiddleware, asyncHandler((req, res) => {
    const { statut, date, date_debut, date_fin, client_id, search, limit: lim } = req.query;
    let query = 'SELECT c.*, u.nom as caissier_nom FROM commandes c LEFT JOIN utilisateurs u ON c.utilisateur_id = u.id WHERE c.succursale_id = ?';
    const params = [req.user.succursale_id || 1];
    if (statut) { query += ' AND c.statut = ?'; params.push(statut); }
    if (date) { query += " AND DATE(c.date_creation) = ?"; params.push(date); }
    if (date_debut) { query += " AND DATE(c.date_creation) >= ?"; params.push(date_debut); }
    if (date_fin) { query += " AND DATE(c.date_creation) <= ?"; params.push(date_fin); }
    if (client_id) { query += " AND c.client_id = ?"; params.push(parseInt(client_id)); }
    if (search) { query += " AND (c.numero LIKE ? OR c.client_nom LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY c.date_creation DESC LIMIT ?';
    params.push(parseInt(lim) || 200);
    res.json(queryAll(query, params));
}));

// Détail d'une commande
router.get('/:id', authMiddleware, asyncHandler((req, res) => {
    const commande = queryOne('SELECT c.*, u.nom as caissier_nom FROM commandes c LEFT JOIN utilisateurs u ON c.utilisateur_id = u.id WHERE c.id = ?', [parseInt(req.params.id)]);
    if (!commande) return res.status(404).json({ error: 'Commande non trouvée' });
    const lignes = queryAll(`SELECT cl.*, p.nom as produit_nom FROM commande_lignes cl LEFT JOIN produits p ON cl.produit_id = p.id WHERE cl.commande_id = ?`, [commande.id]);
    res.json({ ...commande, lignes });
}));

// Créer une commande
router.post('/', authMiddleware, v.createOrderRules, v.handleValidation, asyncHandler((req, res) => {
    const { lignes, mode_paiement, client_id, client_nom, notes, type_commande, table_numero, montant_recu, remise_montant, remise_type, montant_especes, montant_carte, pourboire, statut, generate_facture, type_tarif } = req.body;
    if (!lignes || lignes.length === 0) return res.status(400).json({ error: 'Aucun article dans la commande' });

    // Numéro de commande unique
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStr = now.toISOString().slice(0, 10);
    const countResult = queryOne("SELECT COUNT(*) as c FROM commandes WHERE DATE(date_creation) = ?", [todayStr]);
    const seqNum = (countResult ? countResult.c : 0) + 1;
    const numero = `CMD-${dateStr}-${String(seqNum).padStart(4, '0')}`;

    // Calcul totaux avec TVA
    let sousTotal = 0;
    let totalTva = 0;
    const lignesCalculees = [];

    for (const ligne of lignes) {
        const produit = queryOne('SELECT p.*, t.taux as taux_tva FROM produits p LEFT JOIN taxes t ON p.taxe_id = t.id WHERE p.id = ?', [ligne.produit_id]);
        if (!produit) continue;

        const tauxTva = produit.taux_tva || 0;
        const effectiveTarif = ligne.type_tarif || type_tarif || 'particulier';

        let prixTtc = produit.prix_ttc;
        if (effectiveTarif === 'gros') prixTtc = produit.prix_gros || prixTtc;
        else if (effectiveTarif === 'semi_gros') prixTtc = produit.prix_semi_gros || prixTtc;

        const qte = ligne.quantite || 1;
        const stTtc = +(prixTtc * qte).toFixed(2);
        const prixHt = +(prixTtc / (1 + tauxTva / 100)).toFixed(2);
        const stHt = +(stTtc / (1 + tauxTva / 100)).toFixed(2);
        const montantTva = +(stTtc - stHt).toFixed(2);

        sousTotal += stHt;
        totalTva += montantTva;

        // Accumulate exactly for TTC check
        if (!lignesCalculees.sumTTC) lignesCalculees.sumTTC = 0;
        lignesCalculees.sumTTC += stTtc;

        lignesCalculees.push({
            produit_id: produit.id,
            nom_produit: produit.nom,
            quantite: qte,
            prix_unitaire_ht: prixHt,
            prix_unitaire_ttc: prixTtc,
            taux_tva: tauxTva,
            montant_tva: montantTva,
            sous_total_ht: stHt,
            sous_total_ttc: stTtc,
            notes: ligne.notes || '',
            type_tarif: effectiveTarif
        });
    }

    sousTotal = +sousTotal.toFixed(2);
    totalTva = +totalTva.toFixed(2);
    const remise = parseFloat(remise_montant) || 0;
    const total = +(lignesCalculees.sumTTC - remise).toFixed(2);
    const mRecu = parseFloat(montant_recu) || total;
    let monnaie = 0;
    if (total > 0 && mRecu > total) {
        monnaie = +(mRecu - total).toFixed(2);
    }
    const pointsGagnes = Math.floor(total);

    const finalStatut = (statut === 'attente') ? 'attente' : 'payee';
    const pourb = parseFloat(pourboire) || 0;

    const session = queryOne("SELECT id FROM sessions_caisse WHERE statut = 'ouverte' AND succursale_id = ?", [req.user.succursale_id || 1]);
    if (!session) {
        return res.status(403).json({ error: '⛔ Caisse fermée ! Ouvrez une session de caisse d\'abord.' });
    }
    const sessionId = session.id;

    let partEspeces = 0;
    let partCarte = 0;
    if (mode_paiement === 'especes') partEspeces = total;
    else if (mode_paiement === 'carte') partCarte = total;
    else if (mode_paiement === 'mixte') {
        partEspeces = parseFloat(montant_especes) || 0;
        partCarte = parseFloat(montant_carte) || (total - partEspeces);
    }

    const { transaction } = require('../db');

    const resultPayload = transaction(() => {
        const result = run(
            `INSERT INTO commandes (numero, sous_total, total_tva, remise_montant, remise_type, total, mode_paiement,
           montant_recu, monnaie_rendue, client_id, client_nom, table_numero, type_commande, notes,
         utilisateur_id, succursale_id, statut, points_gagnes, pourboire, type_tarif, session_id, montant_especes, montant_carte)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [numero, sousTotal, totalTva, remise, remise_type || '', total, mode_paiement || 'especes',
                mRecu, monnaie, client_id || null, client_nom || '', table_numero || '',
                type_commande || 'sur_place', notes || '', req.user.id, req.user.succursale_id || 1, finalStatut, pointsGagnes, pourb, type_tarif || 'particulier',
                sessionId, partEspeces, partCarte]
        );
        const commandeId = result.lastInsertRowid;

        for (const l of lignesCalculees) {
            run(
                `INSERT INTO commande_lignes (commande_id, produit_id, nom_produit, quantite, prix_unitaire_ht, prix_unitaire_ttc,
             taux_tva, montant_tva, sous_total_ht, sous_total_ttc, notes, type_tarif) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [commandeId, l.produit_id, l.nom_produit, l.quantite, l.prix_unitaire_ht, l.prix_unitaire_ttc,
                    l.taux_tva, l.montant_tva, l.sous_total_ht, l.sous_total_ttc, l.notes, l.type_tarif]
            );

            const currentStock = queryOne('SELECT * FROM stock WHERE produit_id = ? AND succursale_id = ?',
                [l.produit_id, req.user.succursale_id || 1]);
            if (currentStock) {
                const newQty = currentStock.quantite - l.quantite;
                run('UPDATE stock SET quantite = ?, derniere_maj = CURRENT_TIMESTAMP WHERE id = ?', [newQty, currentStock.id]);

                let typeMvt = 'sortie';
                let qtyMvt = l.quantite;

                if (l.quantite < 0) {
                    typeMvt = 'retour';
                    qtyMvt = Math.abs(l.quantite);
                } else if (finalStatut === 'attente') {
                    typeMvt = 'reserve';
                }

                run('INSERT INTO mouvements_stock (produit_id, succursale_id, type, quantite, quantite_avant, quantite_apres, motif, reference, utilisateur_id) VALUES (?,?,?,?,?,?,?,?,?)',
                    [l.produit_id, req.user.succursale_id || 1, typeMvt, qtyMvt, currentStock.quantite, newQty, finalStatut === 'attente' ? 'Reservation' : (l.quantite < 0 ? 'Retour Client' : 'Vente'), numero, req.user.id]);
            }
        }

        let numeroFacture = '';
        if (finalStatut === 'payee') {
            if (client_id) {
                run('UPDATE clients SET points_fidelite = points_fidelite + ?, total_achats = total_achats + ?, nb_visites = nb_visites + 1 WHERE id = ?',
                    [pointsGagnes, total, client_id]);

                if (mRecu < total) {
                    const resteAPayer = +(total - mRecu).toFixed(2);
                    run('UPDATE clients SET solde_credit = solde_credit + ? WHERE id = ?', [resteAPayer, client_id]);
                    run('INSERT INTO credits_client (client_id, commande_id, montant, type, description, utilisateur_id) VALUES (?,?,?,?,?,?)',
                        [client_id, commandeId, resteAPayer, 'debit', `Vente ${numero} (Reste à payer)`, req.user.id]);
                }
            }

            if (sessionId) {
                if (mode_paiement === 'mixte') {
                    run('UPDATE sessions_caisse SET total_especes = total_especes + ?, total_carte = total_carte + ?, total_ventes = total_ventes + ?, nb_commandes = nb_commandes + 1, total_pourboires = total_pourboires + ? WHERE id = ?',
                        [partEspeces, partCarte, total, pourb, sessionId]);
                } else if (mode_paiement === 'especes') {
                    run('UPDATE sessions_caisse SET total_especes = total_especes + ?, total_ventes = total_ventes + ?, nb_commandes = nb_commandes + 1, total_pourboires = total_pourboires + ? WHERE id = ?', [total, total, pourb, sessionId]);
                } else {
                    run('UPDATE sessions_caisse SET total_carte = total_carte + ?, total_ventes = total_ventes + ?, nb_commandes = nb_commandes + 1, total_pourboires = total_pourboires + ? WHERE id = ?', [total, total, pourb, sessionId]);
                }
            }

            if (generate_facture) {
                const iceParam = queryOne("SELECT valeur FROM parametres WHERE cle = 'ice'");
                const countFacture = queryOne("SELECT COUNT(*) as c FROM commandes WHERE DATE(date_creation) = ? AND (numero_facture IS NOT NULL AND numero_facture != '')", [todayStr]);
                const seqFacture = (countFacture ? countFacture.c : 0) + 1;
                numeroFacture = `FA-${dateStr}-${String(seqFacture).padStart(4, '0')}`;

                const hashIntegrite = facture.generateHash(
                    { numero, date_creation: now.toISOString(), total },
                    iceParam ? iceParam.valeur : ''
                );
                run('UPDATE commandes SET hash_integrite = ?, numero_facture = ? WHERE id = ?',
                    [hashIntegrite, numeroFacture, commandeId]);
            }
        }

        logAudit(req.user.id, req.user.nom, finalStatut === 'attente' ? 'MISE_EN_ATTENTE' : 'VENTE', 'commande', commandeId, `Commande ${numero} — ${total} DH (${finalStatut})`);

        return { id: commandeId, numero, numero_facture: numeroFacture, sous_total: sousTotal, total_tva: totalTva, remise, total, monnaie_rendue: monnaie, points_gagnes: pointsGagnes, lignes: lignesCalculees, mode_paiement: mode_paiement || 'especes', client_nom: client_nom || '', type_commande: type_commande || 'sur_place', caissier_nom: req.user.nom, statut: finalStatut };
    });

    res.json(resultPayload);
}));

// Mettre à jour statut
router.put('/:id/statut', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const { statut } = req.body;
    if (!statut) return res.status(400).json({ error: 'Statut requis' });
    run('UPDATE commandes SET statut = ? WHERE id = ?', [statut, id]);
    logAudit(req.user.id, req.user.nom, 'MAJ_STATUT_CMD', 'commande', id, `Statut: ${statut}`);
    res.json({ success: true });
}));

// Générer facture manuelle
router.post('/:id/facturer', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const cmd = queryOne('SELECT * FROM commandes WHERE id = ?', [id]);
    if (!cmd) return res.status(404).json({ error: 'Commande non trouvée' });
    if (cmd.numero_facture) return res.status(400).json({ error: 'Cette commande a déjà une facture' });

    const todayStr = new Date().toISOString().slice(0, 10);
    const dateStr = todayStr.replace(/-/g, '');
    const countFacture = queryOne("SELECT COUNT(*) as c FROM commandes WHERE DATE(date_creation) = ? AND (numero_facture IS NOT NULL AND numero_facture != '')", [todayStr]);
    const seqFacture = (countFacture ? countFacture.c : 0) + 1;
    const numeroFacture = `FA-${dateStr}-${String(seqFacture).padStart(4, '0')}`;

    const iceParam = queryOne("SELECT valeur FROM parametres WHERE cle = 'ice'");
    const hashIntegrite = facture.generateHash(
        { numero: cmd.numero, date_creation: cmd.date_creation, total: cmd.total },
        iceParam ? iceParam.valeur : ''
    );

    run('UPDATE commandes SET hash_integrite = ?, numero_facture = ? WHERE id = ?',
        [hashIntegrite, numeroFacture, id]);

    logAudit(req.user.id, req.user.nom, 'GENERATION_FACTURE', 'commande', id, `Facture ${numeroFacture} générée manuellement`);
    saveDb();

    res.json({ success: true, numero_facture: numeroFacture });
}));

// Annuler une commande
router.put('/:id/annuler', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const cmd = queryOne('SELECT * FROM commandes WHERE id = ?', [id]);
    if (!cmd) return res.status(404).json({ error: 'Commande non trouvée' });
    if (cmd.statut === 'annulee') return res.status(400).json({ error: 'Déjà annulée' });

    if (cmd.session_id) {
        const session = queryOne('SELECT statut FROM sessions_caisse WHERE id = ?', [cmd.session_id]);
        if (session && session.statut !== 'ouverte') {
            return res.status(403).json({ error: '⛔ Caisse clôturée. Impossible d\'annuler une commande d\'une ancienne session. Utilisez la fonction Retour.' });
        }
    }

    // Restaurer stock
    const lignes = queryAll('SELECT * FROM commande_lignes WHERE commande_id = ?', [id]);
    for (const l of lignes) {
        const stock = queryOne('SELECT * FROM stock WHERE produit_id = ? AND succursale_id = ?', [l.produit_id, cmd.succursale_id || 1]);
        if (stock) {
            const newQty = stock.quantite + l.quantite;
            run('UPDATE stock SET quantite = ?, derniere_maj = CURRENT_TIMESTAMP WHERE id = ?', [newQty, stock.id]);
            run('INSERT INTO mouvements_stock (produit_id, succursale_id, type, quantite, quantite_avant, quantite_apres, motif, reference, utilisateur_id) VALUES (?,?,?,?,?,?,?,?,?)',
                [l.produit_id, cmd.succursale_id || 1, 'entree', l.quantite, stock.quantite, newQty, 'Annulation commande', cmd.numero, req.user.id]);
        }
    }

    // Annuler fidélité
    if (cmd.client_id) {
        run('UPDATE clients SET points_fidelite = MAX(0, points_fidelite - ?), total_achats = MAX(0, total_achats - ?), nb_visites = MAX(0, nb_visites - 1) WHERE id = ?',
            [cmd.points_gagnes || 0, cmd.total, cmd.client_id]);
    }

    run("UPDATE commandes SET statut = 'annulee' WHERE id = ?", [id]);
    logAudit(req.user.id, req.user.nom, 'ANNULATION', 'commande', id, `Commande ${cmd.numero} annulée`);
    res.json({ success: true });
}));

module.exports = router;
