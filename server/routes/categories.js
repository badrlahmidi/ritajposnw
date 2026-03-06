const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly, adminStrict } = require('../middleware');
const { queryAll, run, logAudit } = require('../db');
const v = require('../validators');
const upload = require('../middleware/upload');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    const categories = queryAll('SELECT * FROM categories WHERE actif = 1 ORDER BY ordre');
    res.json(categories);
}));

router.get('/all', authMiddleware, adminOnly, asyncHandler((req, res) => {
    res.json(queryAll('SELECT * FROM categories ORDER BY ordre'));
}));

// Routes

// New Routes
router.post('/', authMiddleware, adminOnly, upload.single('image'), v.createCategoryRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, couleur, icone, ordre } = req.body;
    let image = '';
    if (req.file) image = req.file.filename;

    if (!nom) return res.status(400).json({ error: 'Nom requis' });
    const result = run('INSERT INTO categories (nom, couleur, icone, image, ordre) VALUES (?,?,?,?,?)',
        [nom, couleur || '#e67e22', icone || '🍞', image, ordre || 0]);
    logAudit(req.user.id, req.user.nom, 'CREATION', 'categorie', result.lastInsertRowid, `Catégorie "${nom}" créée`);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, adminOnly, upload.single('image'), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { nom, couleur, icone, ordre, actif } = req.body;

    let fields = [];
    let params = [];

    const add = (col, val) => {
        if (val !== undefined) {
            fields.push(`${col}=?`);
            params.push(val);
        }
    };

    add('nom', nom);
    add('couleur', couleur);
    add('icone', icone);
    add('ordre', ordre);
    add('actif', actif);

    if (req.file) {
        fields.push('image=?');
        params.push(req.file.filename);
    }

    if (fields.length === 0) return res.json({ success: true, message: 'Aucun changement' });

    params.push(id);
    run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);

    res.json({ success: true });
}));

module.exports = router;
