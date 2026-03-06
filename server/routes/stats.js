const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne } = require('../db');
const v = require('../validators');
const facture = require('../facture');

router.get('/jour', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const sid = req.user.succursale_id || 1;
    const { utilisateur_id, categorie_id } = req.query;

    let filterSql = "DATE(c.date_creation) = ? AND c.statut = 'payee' AND c.succursale_id = ?";
    const params = [date, sid];

    if (utilisateur_id) { filterSql += ' AND c.utilisateur_id = ?'; params.push(parseInt(utilisateur_id)); }

    const statsQuery = categorie_id
        ? `SELECT COUNT(DISTINCT c.id) as nb_commandes, 
              COALESCE(SUM(cl.sous_total_ttc), 0) as total_ventes,
              COALESCE(SUM(cl.sous_total_ht), 0) as total_ht,
              COALESCE(SUM(cl.montant_tva), 0) as total_tva,
              0 as total_remises, 0 as total_especes, 0 as total_carte,
              COALESCE(AVG(cl.sous_total_ttc), 0) as panier_moyen
       FROM commande_lignes cl 
       JOIN commandes c ON cl.commande_id = c.id
       JOIN produits p ON cl.produit_id = p.id
       WHERE ${filterSql} AND p.categorie_id = ?`
        : `SELECT COUNT(*) as nb_commandes,
              COALESCE(SUM(total), 0) as total_ventes,
              COALESCE(SUM(sous_total), 0) as total_ht,
              COALESCE(SUM(total_tva), 0) as total_tva,
              COALESCE(SUM(remise_montant), 0) as total_remises,
              COALESCE(SUM(montant_especes), 0) as total_especes,
              COALESCE(SUM(montant_carte), 0) as total_carte,
              COALESCE(AVG(total), 0) as panier_moyen
       FROM commandes c WHERE ${filterSql}`;

    const statsParams = categorie_id ? [...params, parseInt(categorie_id)] : params;
    const stats = queryOne(statsQuery, statsParams) || {};

    const topProduitsQuery = `
      SELECT p.nom, SUM(cl.quantite) as total_qte, SUM(cl.sous_total_ttc) as total_montant
      FROM commande_lignes cl
      JOIN produits p ON cl.produit_id = p.id
      JOIN commandes c ON cl.commande_id = c.id
      WHERE ${filterSql} ${categorie_id ? ' AND p.categorie_id = ?' : ''}
      GROUP BY p.id ORDER BY total_qte DESC LIMIT 10
  `;
    const topProduits = queryAll(topProduitsQuery, categorie_id ? [...params, parseInt(categorie_id)] : params);

    const ventesParHeure = queryAll(`
      SELECT strftime('%H', c.date_creation) as heure, COUNT(DISTINCT c.id) as nb, SUM(cl.sous_total_ttc) as montant
      FROM commande_lignes cl
      JOIN commandes c ON cl.commande_id = c.id
      JOIN produits p ON cl.produit_id = p.id
      WHERE ${filterSql} ${categorie_id ? ' AND p.categorie_id = ?' : ''}
      GROUP BY heure ORDER BY heure
  `, categorie_id ? [...params, parseInt(categorie_id)] : params);

    const depensesJour = categorie_id ? { total_depenses: 0 } : queryOne(`
      SELECT COALESCE(SUM(montant), 0) as total_depenses FROM depenses WHERE date_depense = ? AND succursale_id = ?
  `, [date, sid]);

    res.json({
        ...stats,
        top_produits: topProduits,
        ventes_par_heure: ventesParHeure,
        total_depenses: depensesJour ? depensesJour.total_depenses : 0,
        benefice_brut: (stats.total_ventes || 0) - (depensesJour ? depensesJour.total_depenses : 0)
    });
}));

router.get('/z', authMiddleware, asyncHandler((req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const sid = req.user.succursale_id || 1;

    const sessions = queryAll("SELECT * FROM sessions_caisse WHERE DATE(date_ouverture) = ? AND succursale_id = ?", [date, sid]);

    const sales = queryOne(`
        SELECT COUNT(*) as nb_commandes,
        COALESCE(SUM(total), 0) as total_net,
        COALESCE(SUM(sous_total), 0) as total_ht,
        COALESCE(SUM(total_tva), 0) as total_tva,
        COALESCE(SUM(remise_montant), 0) as total_remises
        FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND succursale_id = ?
    `, [date, sid]);

    const brutStats = queryOne(`
        SELECT COALESCE(SUM(total), 0) as total
        FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND total > 0 AND succursale_id = ?
  `, [date, sid]);

    const refundStats = queryOne(`
        SELECT COUNT(*) as nb, COALESCE(SUM(total), 0) as total
        FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND total < 0 AND succursale_id = ?
  `, [date, sid]);

    const payments = queryAll(`
        SELECT mode_paiement, SUM(total) as montant, COUNT(*) as nb
        FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND succursale_id = ?
        GROUP BY mode_paiement
  `, [date, sid]);

    const fondInitial = sessions.reduce((sum, s) => sum + s.fond_caisse, 0);

    const sessionIds = sessions.map(s => s.id);
    let depots = 0, retraits = 0;
    if (sessionIds.length > 0) {
        const ph = sessionIds.map(() => '?').join(',');
        const mvs = queryAll(`SELECT type, SUM(montant) as total FROM mouvements_caisse WHERE session_id IN (${ph}) GROUP BY type`, sessionIds);
        mvs.forEach(m => {
            if (m.type === 'depot') depots = m.total;
            if (m.type === 'retrait') retraits = m.total;
        });
    }

    const paymentBreakdown = queryOne(`
        SELECT COALESCE(SUM(montant_especes), 0) as total_especes,
               COALESCE(SUM(montant_carte), 0) as total_carte
        FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND succursale_id = ?
    `, [date, sid]);

    const venteEspeces = paymentBreakdown.total_especes;
    const theorique = fondInitial + venteEspeces + depots - retraits;
    const reel = sessions.reduce((sum, s) => sum + (s.statut === 'fermee' ? s.montant_reel : 0), 0);
    const ecart = sessions.reduce((sum, s) => sum + (s.statut === 'fermee' ? s.ecart : 0), 0);

    const tvaBreakdown = queryAll(`
     SELECT cl.taux_tva, SUM(cl.montant_tva) as montant, SUM(cl.sous_total_ht) as base_ht
     FROM commande_lignes cl
     JOIN commandes c ON cl.commande_id = c.id
     WHERE DATE(c.date_creation) = ? AND c.statut = 'payee' AND c.succursale_id = ?
     GROUP BY cl.taux_tva
  `, [date, sid]);

    res.json({
        date,
        sales: {
            brut: brutStats ? brutStats.total : 0,
            retours: { nb: refundStats ? refundStats.nb : 0, montant: refundStats ? refundStats.total : 0 },
            net: sales.total_net,
            ht: sales.total_ht,
            tva: sales.total_tva,
            remises: sales.total_remises,
            nb_commandes: sales.nb_commandes,
            panier_moyen: sales.nb_commandes ? (sales.total_net / sales.nb_commandes) : 0
        },
        payments,
        tva: tvaBreakdown,
        caisse: {
            fond_initial: fondInitial,
            ventes_especes: venteEspeces,
            depots,
            retraits,
            theorique,
            reel,
            ecart,
            sessions_count: sessions.length,
            sessions_closed: sessions.filter(s => s.statut === 'fermee').length
        }
    });
}));

router.get('/periode', authMiddleware, adminOnly, v.periodStatsRules, v.handleValidation, asyncHandler((req, res) => {
    const { date_debut, date_fin, utilisateur_id, categorie_id } = req.query;
    if (!date_debut || !date_fin) return res.status(400).json({ error: 'Dates requises' });
    const sid = req.user.succursale_id || 1;

    let filterSql = "DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?";
    const params = [date_debut, date_fin, sid];
    if (utilisateur_id) { filterSql += ' AND c.utilisateur_id = ?'; params.push(parseInt(utilisateur_id)); }

    const statsQuery = categorie_id
        ? `SELECT COUNT(DISTINCT c.id) as nb_commandes, 
              COALESCE(SUM(cl.sous_total_ttc), 0) as total_ventes,
              COALESCE(SUM(cl.sous_total_ht), 0) as total_ht,
              COALESCE(SUM(cl.montant_tva), 0) as total_tva,
              0 as total_remises, 0 as total_especes, 0 as total_carte,
              COALESCE(AVG(cl.sous_total_ttc), 0) as panier_moyen
       FROM commande_lignes cl 
       JOIN commandes c ON cl.commande_id = c.id
       JOIN produits p ON cl.produit_id = p.id
       WHERE ${filterSql} AND p.categorie_id = ?`
        : `SELECT COUNT(*) as nb_commandes, COALESCE(SUM(total), 0) as total_ventes,
              COALESCE(SUM(sous_total), 0) as total_ht, COALESCE(SUM(total_tva), 0) as total_tva,
              COALESCE(SUM(remise_montant), 0) as total_remises,
              COALESCE(SUM(montant_especes), 0) as total_especes,
              COALESCE(SUM(montant_carte), 0) as total_carte,
              COALESCE(AVG(total), 0) as panier_moyen
       FROM commandes c WHERE ${filterSql}`;

    const statsParams = categorie_id ? [...params, parseInt(categorie_id)] : params;
    const stats = queryOne(statsQuery, statsParams);

    const ventesParJour = queryAll(`
      SELECT DATE(c.date_creation) as jour, COUNT(DISTINCT c.id) as nb, SUM(cl.sous_total_ttc) as montant
      FROM commande_lignes cl
      JOIN commandes c ON cl.commande_id = c.id
      JOIN produits p ON cl.produit_id = p.id
      WHERE ${filterSql} ${categorie_id ? ' AND p.categorie_id = ?' : ''}
      GROUP BY jour ORDER BY jour
    `, categorie_id ? [...params, parseInt(categorie_id)] : params);

    const topProduits = queryAll(`
      SELECT p.nom, SUM(cl.quantite) as total_qte, SUM(cl.sous_total_ttc) as total_montant
      FROM commande_lignes cl JOIN produits p ON cl.produit_id = p.id JOIN commandes c ON cl.commande_id = c.id
      WHERE ${filterSql} ${categorie_id ? ' AND p.categorie_id = ?' : ''}
      GROUP BY p.id ORDER BY total_qte DESC LIMIT 10
    `, categorie_id ? [...params, parseInt(categorie_id)] : params);

    const depenses = categorie_id ? { total: 0 } : queryOne('SELECT COALESCE(SUM(montant),0) as total FROM depenses WHERE date_depense BETWEEN ? AND ? AND succursale_id = ?', [date_debut, date_fin, sid]);

    res.json({ ...stats, ventes_par_jour: ventesParJour, top_produits: topProduits, total_depenses: depenses.total, benefice_brut: (stats.total_ventes || 0) - depenses.total });
}));

router.get('/categories', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { date_debut, date_fin } = req.query;
    const sid = req.user.succursale_id || 1;
    const rapport = queryAll(`
    SELECT cat.nom as categorie, COUNT(cl.id) as nb_articles, SUM(cl.sous_total_ttc) as total_ttc,
           SUM(cl.quantite) as total_qte
    FROM commande_lignes cl
    JOIN produits p ON cl.produit_id = p.id
    JOIN categories cat ON p.categorie_id = cat.id
    JOIN commandes c ON cl.commande_id = c.id
    WHERE DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?
    GROUP BY cat.id ORDER BY total_ttc DESC
  `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
    res.json(rapport);
}));

router.get('/utilisateurs', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { date_debut, date_fin } = req.query;
    const sid = req.user.succursale_id || 1;
    const rapport = queryAll(`
    SELECT u.nom as utilisateur, COUNT(c.id) as nb_commandes, SUM(c.total) as total_ventes,
           AVG(c.total) as panier_moyen
    FROM commandes c
    JOIN utilisateurs u ON c.utilisateur_id = u.id
    WHERE DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?
    GROUP BY u.id ORDER BY total_ventes DESC
  `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
    res.json(rapport);
}));

router.get('/paiements', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { date_debut, date_fin } = req.query;
    const sid = req.user.succursale_id || 1;
    const rapport = queryAll(`
    SELECT mode_paiement, COUNT(*) as nb, SUM(total) as montant,
           AVG(total) as moyenne
    FROM commandes
    WHERE DATE(date_creation) BETWEEN ? AND ? AND statut = 'payee' AND succursale_id = ?
    GROUP BY mode_paiement ORDER BY montant DESC
  `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
    res.json(rapport);
}));

router.get('/marges', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { date_debut, date_fin } = req.query;
    const sid = req.user.succursale_id || 1;
    const rapport = queryAll(`
    SELECT p.nom, SUM(cl.quantite) as qte, 
           SUM(cl.sous_total_ht) as ca_ht,
           SUM(cl.quantite * p.cout_revient) as total_cout,
           SUM(cl.sous_total_ht - (cl.quantite * p.cout_revient)) as marge_brute
    FROM commande_lignes cl
    JOIN produits p ON cl.produit_id = p.id
    JOIN commandes c ON cl.commande_id = c.id
    WHERE DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?
    GROUP BY p.id ORDER BY marge_brute DESC
  `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
    res.json(rapport);
}));

router.get('/credits', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const rapport = queryAll(`
    SELECT c.nom, c.telephone, c.solde_credit,
           (SELECT MAX(date_operation) FROM credits_client WHERE client_id = c.id) as derniere_op
    FROM clients c
    WHERE c.solde_credit > 0
    ORDER BY c.solde_credit DESC
  `);

    const totalGlobal = queryOne('SELECT SUM(solde_credit) as total FROM clients').total || 0;
    res.json({ clients: rapport, total_global: totalGlobal });
}));

router.get('/stock/valorisation', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const sid = req.user.succursale_id || 1;
    const rapport = queryOne(`
    SELECT COUNT(p.id) as nb_produits,
           SUM(s.quantite) as total_unites,
           SUM(s.quantite * p.cout_revient) as valeur_achat,
           SUM(s.quantite * p.prix_ht) as valeur_vente_ht,
           SUM(s.quantite * p.prix_ttc) as valeur_vente_ttc
    FROM stock s
    JOIN produits p ON s.produit_id = p.id
    WHERE s.succursale_id = ? AND p.actif = 1
  `, [sid]);
    res.json(rapport);
}));

router.get('/stock/alertes', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const sid = req.user.succursale_id || 1;
    const rapport = queryAll(`
    SELECT p.nom, s.quantite, s.seuil_alerte, s.unite, cat.nom as categorie
    FROM stock s
    JOIN produits p ON s.produit_id = p.id
    LEFT JOIN categories cat ON p.categorie_id = cat.id
    WHERE s.succursale_id = ? AND s.quantite <= s.seuil_alerte AND p.actif = 1
    ORDER BY s.quantite ASC
  `, [sid]);
    res.json(rapport);
}));

router.get('/audit', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { date_debut, date_fin, action } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE DATE(date_action) BETWEEN ? AND ?';
    const params = [date_debut || '1970-01-01', date_fin || '2099-12-31'];

    if (action) {
        sql += ' AND action = ?';
        params.push(action);
    }

    sql += ' ORDER BY date_action DESC LIMIT 200';
    const rapport = queryAll(sql, params);
    res.json(rapport);
}));

router.get('/export/pdf', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const { type, date_debut, date_fin } = req.query;
    const sid = req.user.succursale_id || 1;
    const params = queryAll('SELECT * FROM parametres');
    const paramObj = {};
    params.forEach(p => paramObj[p.cle] = p.valeur);

    let title = "Rapport POS";
    let columns = [];
    let data = [];
    let summary = [];

    if (type === 'synthese') {
        title = "Synthèse Générale des Ventes";
        const s = queryOne(date_debut === date_fin
            ? `SELECT COUNT(*) as nb_commandes, SUM(total) as total_ventes, SUM(sous_total) as total_ht, SUM(total_tva) as total_tva FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND succursale_id = ?`
            : `SELECT COUNT(*) as nb_commandes, SUM(total) as total_ventes, SUM(sous_total) as total_ht, SUM(total_tva) as total_tva FROM commandes WHERE DATE(date_creation) BETWEEN ? AND ? AND statut = 'payee' AND succursale_id = ?`,
            date_debut === date_fin ? [date_debut, sid] : [date_debut, date_fin, sid]
        );
        summary = [
            { label: 'Commandes', value: s.nb_commandes || 0 },
            { label: 'Ventes TTC', value: `${(s.total_ventes || 0).toFixed(2)} ${paramObj.devise || 'DH'}` },
            { label: 'Total HT', value: `${(s.total_ht || 0).toFixed(2)} ${paramObj.devise || 'DH'}` },
            { label: 'Total TVA', value: `${(s.total_tva || 0).toFixed(2)} ${paramObj.devise || 'DH'}` }
        ];
        data = queryAll(`SELECT DATE(date_creation) as jour, COUNT(*) as nb, SUM(total) as montant FROM commandes WHERE DATE(date_creation) BETWEEN ? AND ? AND statut = 'payee' AND succursale_id = ? GROUP BY jour`, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
        columns = [{ header: 'Date', key: 'jour', width: 200 }, { header: 'Commandes', key: 'nb', width: 150, align: 'center' }, { header: 'Total TTC', key: 'montant', width: 150, align: 'right' }];

    } else if (type === 'utilisateurs') {
        title = "Performance des Caissiers";
        data = queryAll(`
      SELECT u.nom, COUNT(c.id) as nb, SUM(c.total) as total
      FROM commandes c JOIN utilisateurs u ON c.utilisateur_id = u.id
      WHERE DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?
      GROUP BY u.id ORDER BY total DESC
    `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
        columns = [{ header: 'Caissier', key: 'nom', width: 250 }, { header: 'Commandes', key: 'nb', width: 100, align: 'center' }, { header: 'Total Ventes', key: 'total', width: 150, align: 'right' }];

    } else if (type === 'paiements') {
        title = "Journal des Paiements";
        data = queryAll(`
      SELECT mode_paiement, COUNT(*) as nb, SUM(total) as montant
      FROM commandes WHERE DATE(date_creation) BETWEEN ? AND ? AND statut = 'payee' AND succursale_id = ?
      GROUP BY mode_paiement ORDER BY montant DESC
    `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
        columns = [{ header: 'Mode de Paiement', key: 'mode_paiement', width: 250 }, { header: 'Transactions', key: 'nb', width: 100, align: 'center' }, { header: 'Total', key: 'montant', width: 150, align: 'right' }];

    } else if (type === 'stock-valorisation') {
        title = "Rapport de Valorisation de Stock";
        const v = queryOne(`SELECT COUNT(p.id) as nb, SUM(s.quantite) as qte, SUM(s.quantite*p.cout_revient) as achat, SUM(s.quantite*p.prix_ttc) as vente FROM stock s JOIN produits p ON s.produit_id=p.id WHERE s.succursale_id=? AND p.actif=1`, [sid]);
        summary = [
            { label: 'Produits', value: v.nb || 0 },
            { label: 'Unités Stock', value: v.qte || 0 },
            { label: 'Valeur Achat', value: `${(v.achat || 0).toFixed(2)} ${paramObj.devise || 'DH'}` },
            { label: 'Valeur Vente', value: `${(v.vente || 0).toFixed(2)} ${paramObj.devise || 'DH'}` }
        ];
        data = queryAll(`SELECT p.nom, s.quantite, p.cout_revient, p.prix_ttc, (s.quantite*p.prix_ttc) as total FROM stock s JOIN produits p ON s.produit_id=p.id WHERE s.succursale_id=? AND p.actif=1 ORDER BY total DESC`, [sid]);
        columns = [{ header: 'Produit', key: 'nom', width: 200 }, { header: 'Stock', key: 'quantite', width: 70, align: 'center' }, { header: 'P.U Achat', key: 'cout_revient', width: 80, align: 'right' }, { header: 'P.U Vente', key: 'prix_ttc', width: 80, align: 'right' }, { header: 'Total Valeur', key: 'total', width: 70, align: 'right' }];

    } else if (type === 'audit') {
        title = "Journal d'Audit Système";
        data = queryAll(`SELECT date_action, utilisateur_nom, action, entite, details FROM audit_log WHERE DATE(date_action) BETWEEN ? AND ? ORDER BY date_action DESC LIMIT 500`, [date_debut || '1970-01-01', date_fin || '2099-12-31']);
        columns = [{ header: 'Date', key: 'date_action', width: 120 }, { header: 'Utilisateur', key: 'utilisateur_nom', width: 100 }, { header: 'Action', key: 'action', width: 100 }, { header: 'Entité', key: 'entite', width: 80 }, { header: 'DETAIls', key: 'details', width: 100 }];

    } else if (type === 'credits') {
        title = "Rapport des Crédits Clients";
        data = queryAll(`SELECT nom, telephone, solde_credit FROM clients WHERE solde_credit > 0 ORDER BY solde_credit DESC`);
        const total = queryOne('SELECT SUM(solde_credit) as total FROM clients').total || 0;
        summary = [{ label: 'Total des Crédits', value: `${total.toFixed(2)} ${paramObj.devise || 'DH'}` }];
        columns = [
            { header: 'Client', key: 'nom', width: 250 },
            { header: 'Téléphone', key: 'telephone', width: 150 },
            { header: 'Solde Crédit', key: 'solde_credit', width: 100, align: 'right' }
        ];

    } else if (type === 'tva') {
        title = `Rapport de TVA (Z-Report) - ${date_debut}`;
        data = queryAll(`
      SELECT cl.taux_tva as taux, SUM(cl.sous_total_ht) as base_ht, SUM(cl.montant_tva) as montant_tva, SUM(cl.sous_total_ttc) as total_ttc
      FROM commande_lignes cl JOIN commandes c ON cl.commande_id = c.id
      WHERE DATE(c.date_creation) = ? AND c.statut = 'payee' AND c.succursale_id = ?
      GROUP BY cl.taux_tva
    `, [date_debut, sid]);
        const s = queryOne(`SELECT SUM(sous_total) as ht, SUM(total_tva) as tva, SUM(total) as ttc FROM commandes WHERE DATE(date_creation) = ? AND statut = 'payee' AND succursale_id = ?`, [date_debut, sid]);
        summary = [
            { label: 'Total HT', value: `${(s.ht || 0).toFixed(2)} ${paramObj.devise || 'DH'}` },
            { label: 'Total TVA', value: `${(s.tva || 0).toFixed(2)} ${paramObj.devise || 'DH'}` },
            { label: 'Total TTC', value: `${(s.ttc || 0).toFixed(2)} ${paramObj.devise || 'DH'}` }
        ];
        columns = [
            { header: 'Taux TVA', key: 'taux', width: 150, align: 'center' },
            { header: 'Base HT', key: 'base_ht', width: 150, align: 'right' },
            { header: 'Montant TVA', key: 'montant_tva', width: 150, align: 'right' },
            { header: 'Total TTC', key: 'total_ttc', width: 150, align: 'right' }
        ];

    } else if (type === 'categories') {
        title = "Rapport des Ventes par Catégorie";
        data = queryAll(`
      SELECT cat.nom as categorie, COUNT(cl.id) as nb_articles, SUM(cl.quantite) as total_qte, SUM(cl.sous_total_ttc) as total_ttc
      FROM commande_lignes cl JOIN produits p ON cl.produit_id = p.id JOIN categories cat ON p.categorie_id = cat.id JOIN commandes c ON cl.commande_id = c.id
      WHERE DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?
      GROUP BY cat.id ORDER BY total_ttc DESC
    `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
        columns = [
            { header: 'Catégorie', key: 'categorie', width: 200 },
            { header: 'Articles', key: 'nb_articles', width: 100, align: 'center' },
            { header: 'Quantité', key: 'total_qte', width: 100, align: 'center' },
            { header: 'Total TTC', key: 'total_ttc', width: 100, align: 'right' }
        ];
    } else if (type === 'marges') {
        title = "Rapport de Rentabilité (Marges)";
        data = queryAll(`
      SELECT p.nom, SUM(cl.quantite) as qte, SUM(cl.sous_total_ht) as ca_ht, SUM(cl.quantite * p.cout_revient) as total_cout, SUM(cl.sous_total_ht - (cl.quantite * p.cout_revient)) as marge
      FROM commande_lignes cl JOIN produits p ON cl.produit_id = p.id JOIN commandes c ON cl.commande_id = c.id
      WHERE DATE(c.date_creation) BETWEEN ? AND ? AND c.statut = 'payee' AND c.succursale_id = ?
      GROUP BY p.id ORDER BY marge DESC
    `, [date_debut || '1970-01-01', date_fin || '2099-12-31', sid]);
        columns = [
            { header: 'Produit', key: 'nom', width: 180 },
            { header: 'Qté', key: 'qte', width: 50, align: 'center' },
            { header: 'CA HT', key: 'ca_ht', width: 90, align: 'right' },
            { header: 'Coût', key: 'total_cout', width: 90, align: 'right' },
            { header: 'Marge', key: 'marge', width: 90, align: 'right' }
        ];
    } else if (type === 'stock-alertes') {
        title = "Rapport d'Alertes Stock";
        data = queryAll(`
      SELECT p.nom, cat.nom as cat, s.quantite, s.seuil_alerte 
      FROM stock s JOIN produits p ON s.produit_id = p.id LEFT JOIN categories cat ON p.categorie_id = cat.id
      WHERE s.succursale_id = ? AND s.quantite <= s.seuil_alerte AND p.actif = 1
      ORDER BY s.quantite ASC
    `, [sid]);
        columns = [
            { header: 'Produit', key: 'nom', width: 200 },
            { header: 'Catégorie', key: 'cat', width: 100 },
            { header: 'Stock', key: 'quantite', width: 100, align: 'center' },
            { header: 'Seuil', key: 'seuil_alerte', width: 100, align: 'center' }
        ];
    }

    const doc = facture.genererRapportPDF({ title, columns, data, summary, params: paramObj });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapport_${type}.pdf`);
    doc.pipe(res);
    doc.end();
}));

module.exports = router;
