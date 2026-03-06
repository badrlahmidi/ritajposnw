const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit } = require('../db');
const v = require('../validators');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    const stocks = queryAll(`
      SELECT s.*, p.nom as produit_nom, p.prix_ttc, c.nom as categorie_nom, c.couleur as categorie_couleur
      FROM stock s
      JOIN produits p ON s.produit_id = p.id
      LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND s.succursale_id = ?
      ORDER BY p.nom
    `, [req.user.succursale_id || 1]);
    res.json(stocks);
}));

router.get('/alertes', authMiddleware, asyncHandler((req, res) => {
    const alertes = queryAll(`
      SELECT s.*, p.nom as produit_nom, p.prix_ttc, c.nom as categorie_nom
      FROM stock s JOIN produits p ON s.produit_id = p.id LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.actif = 1 AND s.quantite <= s.seuil_alerte AND s.succursale_id = ?
      ORDER BY s.quantite ASC
    `, [req.user.succursale_id || 1]);
    res.json(alertes);
}));

router.put('/:produit_id', authMiddleware, adminOnly, v.updateStockRules, v.handleValidation, asyncHandler((req, res) => {
    const produitId = parseInt(req.params.produit_id);
    const { quantite, seuil_alerte, motif } = req.body;
    const stock = queryOne('SELECT * FROM stock WHERE produit_id = ? AND succursale_id = ?', [produitId, req.user.succursale_id || 1]);
    if (!stock) return res.status(404).json({ error: 'Stock non trouvé' });
    const oldQty = stock.quantite;
    const newQty = parseFloat(quantite);
    const diff = newQty - oldQty;
    run('UPDATE stock SET quantite = ?, seuil_alerte = COALESCE(?, seuil_alerte), derniere_maj = CURRENT_TIMESTAMP WHERE id = ?',
        [newQty, seuil_alerte !== undefined ? seuil_alerte : null, stock.id]);
    run('INSERT INTO mouvements_stock (produit_id, succursale_id, type, quantite, quantite_avant, quantite_apres, motif, utilisateur_id) VALUES (?,?,?,?,?,?,?,?)',
        [produitId, req.user.succursale_id || 1, diff >= 0 ? 'entree' : 'sortie', Math.abs(diff), oldQty, newQty, motif || 'Ajustement manuel', req.user.id]);
    logAudit(req.user.id, req.user.nom, 'AJUSTEMENT_STOCK', 'stock', stock.id, `Produit #${produitId}: ${oldQty} → ${newQty}`);
    res.json({ success: true });
}));

router.get('/mouvements', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { produit_id, date_debut, date_fin } = req.query;
    let query = `SELECT ms.*, p.nom as produit_nom, u.nom as utilisateur_nom
                 FROM mouvements_stock ms
                 LEFT JOIN produits p ON ms.produit_id = p.id
                 LEFT JOIN utilisateurs u ON ms.utilisateur_id = u.id
                 WHERE ms.succursale_id = ?`;
    const params = [req.user.succursale_id || 1];
    if (produit_id) { query += ' AND ms.produit_id = ?'; params.push(parseInt(produit_id)); }
    if (date_debut) { query += ' AND DATE(ms.date_mouvement) >= ?'; params.push(date_debut); }
    if (date_fin) { query += ' AND DATE(ms.date_mouvement) <= ?'; params.push(date_fin); }
    query += ' ORDER BY ms.date_mouvement DESC LIMIT 500';
    res.json(queryAll(query, params));
}));

// Ajustement Rapide (Inventaire)
router.post('/adjust', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { produit_id, quantite, motif, type } = req.body;
    if (!produit_id || quantite === undefined) return res.status(400).json({ error: 'Données incomplètes' });

    const stock = queryOne('SELECT * FROM stock WHERE produit_id = ? AND succursale_id = ?', [produit_id, req.user.succursale_id || 1]);

    if (!stock) {
        run('INSERT INTO stock (produit_id, succursale_id, quantite, seuil_alerte) VALUES (?,?,?,?)',
            [produit_id, req.user.succursale_id || 1, quantite, 5]);
    } else {
        run('UPDATE stock SET quantite = ?, derniere_maj = CURRENT_TIMESTAMP WHERE id = ?', [quantite, stock.id]);
    }

    const qtyAvant = stock ? stock.quantite : 0;

    run('INSERT INTO mouvements_stock (produit_id, succursale_id, type, quantite, quantite_avant, quantite_apres, motif, reference, utilisateur_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [produit_id, req.user.succursale_id || 1, 'correction', Math.abs(quantite - qtyAvant), qtyAvant, quantite, motif || 'Ajustement manuel', 'INV-RAPIDE', req.user.id]);

    logAudit(req.user.id, req.user.nom, 'AJUSTEMENT_STOCK', 'stock', produit_id, `Stock ajusté: ${qtyAvant} -> ${quantite}`);
    res.json({ success: true });
}));

// ════════ INVENTAIRE GESTION ════════

// 1. Créer une session d'inventaire
router.post('/inventory', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { notes } = req.body;
    const result = run('INSERT INTO inventory_sessions (notes, utilisateur_id, succursale_id) VALUES (?,?,?)',
        [notes || '', req.user.id, req.user.succursale_id || 1]);
    res.json({ id: result.lastInsertRowid, success: true });
}));

// 2. Get active session
router.get('/inventory/active', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const session = queryOne("SELECT * FROM inventory_sessions WHERE statut = 'active' AND succursale_id = ? ORDER BY id DESC LIMIT 1", [req.user.succursale_id || 1]);
    if (!session) return res.json(null);
    const lignes = queryAll(`
        SELECT il.*, p.nom, p.code_barre, p.prix_ttc 
        FROM inventory_lines il 
        JOIN produits p ON il.produit_id = p.id 
        WHERE il.session_id = ? ORDER BY il.id DESC`, [session.id]);
    res.json({ ...session, lignes });
}));

// 3. Scan produit dans inventaire
router.post('/inventory/:id/scan', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const sessionId = parseInt(req.params.id);
    const { code_barre, quantite } = req.body;

    const session = queryOne("SELECT * FROM inventory_sessions WHERE id = ?", [sessionId]);
    if (!session || session.statut !== 'active') return res.status(400).json({ error: "Session invalide" });

    // Recherche produit
    let p = queryOne("SELECT * FROM produits WHERE code_barre = ?", [code_barre]);
    if (!p) p = queryOne("SELECT * FROM produits WHERE id = ?", [code_barre]); // Fallback ID

    if (!p) return res.status(404).json({ error: "Produit non trouvé" });

    // Get current stock
    const stock = queryOne("SELECT quantite FROM stock WHERE produit_id = ? AND succursale_id = ?", [p.id, req.user.succursale_id || 1]);
    const qtyTheorique = stock ? stock.quantite : 0;

    // Check existing line
    const line = queryOne("SELECT * FROM inventory_lines WHERE session_id = ? AND produit_id = ?", [sessionId, p.id]);

    if (line) {
        const newQty = parseFloat(quantite);
        const ecart = newQty - qtyTheorique;
        run("UPDATE inventory_lines SET quantite_reelle = ?, ecart = ? WHERE id = ?", [newQty, ecart, line.id]);
    } else {
        const ecart = parseFloat(quantite) - qtyTheorique;
        run("INSERT INTO inventory_lines (session_id, produit_id, quantite_theorique, quantite_reelle, ecart) VALUES (?,?,?,?,?)",
            [sessionId, p.id, qtyTheorique, parseFloat(quantite), ecart]);
    }

    res.json({ success: true, nom: p.nom, prev: qtyTheorique });
}));

// 4. Commit Inventaire (Transaction)
router.post('/inventory/:id/commit', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const sessionId = parseInt(req.params.id);
    const { transaction } = require('../db');

    transaction(() => {
        const lines = queryAll("SELECT * FROM inventory_lines WHERE session_id = ?", [sessionId]);

        for (const line of lines) {
            if (line.ecart !== 0) {
                // Update Stock
                const stock = queryOne("SELECT id, quantite FROM stock WHERE produit_id = ? AND succursale_id = ?", [line.produit_id, req.user.succursale_id || 1]);
                if (stock) {
                    run("UPDATE stock SET quantite = ?, derniere_maj = CURRENT_TIMESTAMP WHERE id = ?", [line.quantite_reelle, stock.id]);
                } else {
                    run("INSERT INTO stock (produit_id, succursale_id, quantite) VALUES (?,?,?)", [line.produit_id, req.user.succursale_id || 1, line.quantite_reelle]);
                }

                // Log Movement
                run("INSERT INTO mouvements_stock (produit_id, succursale_id, type, quantite, quantite_avant, quantite_apres, motif, reference, utilisateur_id) VALUES (?,?,?,?,?,?,?,?,?)",
                    [line.produit_id, req.user.succursale_id || 1, 'correction', Math.abs(line.ecart), line.quantite_theorique, line.quantite_reelle, 'Inventaire #' + sessionId, 'INV-' + sessionId, req.user.id]);
            }
        }

        run("UPDATE inventory_sessions SET statut = 'cloturee', date_cloture = CURRENT_TIMESTAMP WHERE id = ?", [sessionId]);
        logAudit(req.user.id, req.user.nom, 'CLOTURE_INVENTAIRE', 'inventory_sessions', sessionId, `Inventaire #${sessionId} validé`);
    });

    res.json({ success: true });
}));

// 5. Achat Fournisseur
router.post('/achat', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { fournisseur_id, reference_facture, montant_total, lignes, notes, mode_paiement } = req.body;
    const { transaction } = require('../db');

    if (!fournisseur_id || !lignes || !lignes.length) {
        return res.status(400).json({ error: 'Données incomplètes (fournisseur ou lignes manquantes)' });
    }

    transaction(() => {
        // Enregistrer la dépense
        const depenseInsert = run(
            'INSERT INTO depenses (categorie, montant, description, fournisseur_id, mode_paiement, utilisateur_id, succursale_id) VALUES (?,?,?,?,?,?,?)',
            ['Achat Marchandises', montant_total, `Achat Fournisseur / Ref: ${reference_facture || 'N/A'}` + (notes ? ` - ${notes}` : ''), fournisseur_id, mode_paiement || 'especes', req.user.id, req.user.succursale_id || 1]
        );
        const depenseId = depenseInsert.lastInsertRowid;

        // Parcourir les lignes et mettre à jour le stock
        for (const ligne of lignes) {
            const qty = parseFloat(ligne.quantite);
            if (qty <= 0) continue;

            const prixAchat = parseFloat(ligne.prix_achat) || 0;
            if (prixAchat > 0) {
                // Mettre à jour le coût de revient du produit
                run("UPDATE produits SET cout_revient = ? WHERE id = ?", [prixAchat, ligne.produit_id]);
            }

            const stock = queryOne("SELECT id, quantite FROM stock WHERE produit_id = ? AND succursale_id = ?", [ligne.produit_id, req.user.succursale_id || 1]);
            let oldQty = 0;
            let newQty = qty;

            if (stock) {
                oldQty = stock.quantite;
                newQty = oldQty + qty;
                run("UPDATE stock SET quantite = ?, derniere_maj = CURRENT_TIMESTAMP WHERE id = ?", [newQty, stock.id]);
            } else {
                run("INSERT INTO stock (produit_id, succursale_id, quantite) VALUES (?,?,?)", [ligne.produit_id, req.user.succursale_id || 1, newQty]);
            }

            // Historique mouvement
            run("INSERT INTO mouvements_stock (produit_id, succursale_id, type, quantite, quantite_avant, quantite_apres, motif, reference, utilisateur_id) VALUES (?,?,?,?,?,?,?,?,?)",
                [ligne.produit_id, req.user.succursale_id || 1, 'entree', qty, oldQty, newQty, 'Achat Fournisseur', reference_facture || `DEP-${depenseId}`, req.user.id]);
        }

        logAudit(req.user.id, req.user.nom, 'ACHAT_FOURNISSEUR', 'depenses', depenseId, `Achat de ${montant_total} DH / ${lignes.length} articles`);
    });

    res.json({ success: true });
}));

module.exports = router;
