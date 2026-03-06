const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, run } = require('../db');
const v = require('../validators');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    res.json(queryAll('SELECT * FROM remises WHERE actif = 1 ORDER BY nom'));
}));

router.post('/', authMiddleware, adminOnly, v.createDiscountRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, type, valeur, condition_min, date_debut, date_fin, produit_id } = req.body;
    if (!nom || !valeur) return res.status(400).json({ error: 'Nom et valeur requis' });
    const result = run('INSERT INTO remises (nom, type, valeur, condition_min, date_debut, date_fin, produit_id) VALUES (?,?,?,?,?,?,?)',
        [nom, type || 'pourcentage', valeur, condition_min || 0, date_debut || null, date_fin || null, produit_id || null]);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { nom, type, valeur, condition_min, date_debut, date_fin, produit_id, actif } = req.body;
    run('UPDATE remises SET nom=?, type=?, valeur=?, condition_min=?, date_debut=?, date_fin=?, produit_id=?, actif=? WHERE id=?',
        [nom, type, valeur, condition_min, date_debut, date_fin, produit_id || null, actif !== undefined ? actif : 1, parseInt(req.params.id)]);
    res.json({ success: true });
}));

module.exports = router;
