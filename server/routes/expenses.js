const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, run, logAudit } = require('../db');
const v = require('../validators');

router.get('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { date_debut, date_fin } = req.query;
    let query = 'SELECT d.*, f.nom as fournisseur_nom, u.nom as utilisateur_nom FROM depenses d LEFT JOIN fournisseurs f ON d.fournisseur_id = f.id LEFT JOIN utilisateurs u ON d.utilisateur_id = u.id WHERE d.succursale_id = ?';
    const params = [req.user.succursale_id || 1];
    if (date_debut) { query += ' AND d.date_depense >= ?'; params.push(date_debut); }
    if (date_fin) { query += ' AND d.date_depense <= ?'; params.push(date_fin); }
    query += ' ORDER BY d.date_depense DESC LIMIT 500';
    res.json(queryAll(query, params));
}));

router.post('/', authMiddleware, adminOnly, v.createExpenseRules, v.handleValidation, asyncHandler((req, res) => {
    const { categorie, montant, description, fournisseur_id, mode_paiement, date_depense } = req.body;
    if (!categorie || !montant) return res.status(400).json({ error: 'Catégorie et montant requis' });
    const result = run('INSERT INTO depenses (categorie, montant, description, fournisseur_id, mode_paiement, date_depense, utilisateur_id, succursale_id) VALUES (?,?,?,?,?,?,?,?)',
        [categorie, montant, description || '', fournisseur_id || null, mode_paiement || 'especes', date_depense || new Date().toISOString().slice(0, 10), req.user.id, req.user.succursale_id || 1]);
    logAudit(req.user.id, req.user.nom, 'DEPENSE', 'depense', result.lastInsertRowid, `${categorie}: ${montant} DH`);
    res.json({ id: result.lastInsertRowid, success: true });
}));

module.exports = router;
