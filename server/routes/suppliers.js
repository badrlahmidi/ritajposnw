const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryAll, run } = require('../db');
const v = require('../validators');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    res.json(queryAll('SELECT * FROM fournisseurs WHERE actif = 1 ORDER BY nom'));
}));

router.post('/', authMiddleware, v.createSupplierRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, contact, telephone, email, adresse, notes } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis' });
    const result = run('INSERT INTO fournisseurs (nom, contact, telephone, email, adresse, notes) VALUES (?,?,?,?,?,?)',
        [nom, contact || '', telephone || '', email || '', adresse || '', notes || '']);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const { nom, contact, telephone, email, adresse, notes, actif } = req.body;

    if (!nom) return res.status(400).json({ error: 'Nom requis' });

    run('UPDATE fournisseurs SET nom=?, contact=?, telephone=?, email=?, adresse=?, notes=?, actif=? WHERE id=?',
        [nom, contact || '', telephone || '', email || '', adresse || '', notes || '', actif !== undefined ? actif : 1, id]);
    res.json({ success: true });
}));

router.delete('/:id', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    // Au lieu de supprimer on désactive
    run('UPDATE fournisseurs SET actif = 0 WHERE id = ?', [id]);
    res.json({ success: true });
}));

module.exports = router;
