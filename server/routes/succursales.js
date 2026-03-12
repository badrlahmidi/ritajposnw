const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit, saveDb } = require('../db');

// ════════ GET ALL ════════
router.get('/', authMiddleware, asyncHandler((req, res) => {
    const succursales = queryAll(`SELECT * FROM succursales ORDER BY id`);
    res.json(succursales);
}));

// ════════ GET ONE ════════
router.get('/:id', authMiddleware, asyncHandler((req, res) => {
    const s = queryOne('SELECT * FROM succursales WHERE id = ?', [parseInt(req.params.id)]);
    if (!s) return res.status(404).json({ error: 'Succursale non trouvée' });
    res.json(s);
}));

// ════════ CREATE ════════
router.post('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const { nom, adresse, ville, telephone, email, ice } = req.body;
    if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom est requis' });

    const result = run(
        `INSERT INTO succursales (nom, adresse, ville, telephone, email, ice, actif)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [nom.trim(), adresse || '', ville || '', telephone || '', email || '', ice || '']
    );
    const id = result.lastInsertRowid;

    // Créer stock entries pour les produits existants dans la nouvelle succursale
    const produits = queryAll('SELECT id FROM produits WHERE actif = 1');
    for (const p of produits) {
        try {
            run('INSERT OR IGNORE INTO stock (produit_id, succursale_id, quantite, seuil_alerte) VALUES (?,?,0,5)',
                [p.id, id]);
        } catch (e) { }
    }

    logAudit(req.user.id, req.user.nom, 'CREATION', 'succursales', id, `Succursale "${nom}" créée`);
    res.json({ success: true, id });
}));

// ════════ UPDATE ════════
router.put('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    if (id === 1) {
        // Succursale principale : autoriser uniquement la modification des infos
    }
    const { nom, adresse, ville, telephone, email, ice, actif } = req.body;
    if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom est requis' });

    run(
        `UPDATE succursales SET nom=?, adresse=?, ville=?, telephone=?, email=?, ice=?, actif=?
         WHERE id=?`,
        [nom.trim(), adresse || '', ville || '', telephone || '', email || '', ice || '',
        actif !== undefined ? (actif ? 1 : 0) : 1, id]
    );
    logAudit(req.user.id, req.user.nom, 'MODIFICATION', 'succursales', id, `Succursale #${id} modifiée`);
    res.json({ success: true });
}));

// ════════ TOGGLE ACTIF ════════
router.patch('/:id/toggle', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    if (id === 1) return res.status(400).json({ error: 'Impossible de désactiver la succursale principale' });
    const s = queryOne('SELECT actif FROM succursales WHERE id = ?', [id]);
    if (!s) return res.status(404).json({ error: 'Succursale non trouvée' });
    run('UPDATE succursales SET actif = ? WHERE id = ?', [s.actif ? 0 : 1, id]);
    logAudit(req.user.id, req.user.nom, s.actif ? 'DESACTIVATION' : 'ACTIVATION', 'succursales', id, `Succursale #${id}`);
    res.json({ success: true, actif: !s.actif });
}));

// ════════ STATS PAR SUCCURSALE ════════
router.get('/:id/stats', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const today = new Date().toISOString().slice(0, 10);
    const stats = queryOne(
        `SELECT COUNT(*) as nb_commandes,
                COALESCE(SUM(total), 0) as total_ventes,
                COALESCE(SUM(total_tva), 0) as total_tva
         FROM commandes WHERE DATE(date_creation) = ? AND statut='payee' AND succursale_id=?`,
        [today, id]
    );
    const stock = queryOne(
        `SELECT COUNT(DISTINCT produit_id) as nb_produits,
                COALESCE(SUM(quantite), 0) as total_unites
         FROM stock WHERE succursale_id=?`,
        [id]
    );
    res.json({ ...stats, ...stock, date: today });
}));

module.exports = router;
