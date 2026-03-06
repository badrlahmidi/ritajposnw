const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly, adminStrict } = require('../middleware');
const { queryAll, run } = require('../db');
const v = require('../validators');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    res.json(queryAll('SELECT * FROM taxes WHERE actif = 1 ORDER BY taux'));
}));

router.post('/', authMiddleware, adminStrict, v.createTaxRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, taux, par_defaut } = req.body;
    if (!nom || taux === undefined) return res.status(400).json({ error: 'Nom et taux requis' });
    const result = run('INSERT INTO taxes (nom, taux, par_defaut) VALUES (?,?,?)', [nom, taux, par_defaut || 0]);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const { nom, taux, par_defaut, actif } = req.body;

    let fields = [];
    let params = [];
    const add = (col, val) => { if (val !== undefined) { fields.push(`${col}=?`); params.push(val); } };

    add('nom', nom);
    add('taux', taux);
    add('par_defaut', par_defaut);
    add('actif', actif);

    if (fields.length === 0) return res.json({ success: true });
    params.push(id);
    run(`UPDATE taxes SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
}));

module.exports = router;
