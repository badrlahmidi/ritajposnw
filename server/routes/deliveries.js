const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryAll, run, logAudit } = require('../db');

// Lister les livraisons du jour
router.get('/', authMiddleware, asyncHandler((req, res) => {
    const { statut, date } = req.query;
    let query = `SELECT l.*, c.numero as commande_numero, c.total as commande_total,
               c.client_nom, u.nom as livreur_nom
               FROM livraisons l
               LEFT JOIN commandes c ON l.commande_id = c.id
               LEFT JOIN utilisateurs u ON l.livreur_id = u.id
               WHERE 1=1`;
    const params = [];
    if (statut) { query += ' AND l.statut = ?'; params.push(statut); }
    if (date) { query += ' AND DATE(l.date_creation) = ?'; params.push(date); }
    else { query += " AND DATE(l.date_creation) = DATE('now')"; }
    query += ' ORDER BY l.date_creation DESC';
    res.json(queryAll(query, params));
}));

// Créer une livraison
router.post('/', authMiddleware, asyncHandler((req, res) => {
    const { commande_id, adresse, telephone, zone, frais_livraison, notes, date_livraison_prevue } = req.body;
    if (!commande_id) return res.status(400).json({ error: 'Commande requise' });
    const result = run(
        'INSERT INTO livraisons (commande_id, adresse, telephone, zone, frais_livraison, notes, date_livraison_prevue) VALUES (?,?,?,?,?,?,?)',
        [commande_id, adresse || '', telephone || '', zone || '', frais_livraison || 0, notes || '', date_livraison_prevue || null]
    );
    res.json({ id: result.lastInsertRowid, success: true });
}));

// Mettre à jour le statut
router.put('/:id/statut', authMiddleware, asyncHandler((req, res) => {
    const { statut, livreur_id } = req.body;
    const id = parseInt(req.params.id);
    if (!statut) return res.status(400).json({ error: 'Statut requis' });
    const fields = ['statut = ?'];
    const params = [statut];
    if (livreur_id) { fields.push('livreur_id = ?'); params.push(livreur_id); }
    if (statut === 'livree') { fields.push("date_livraison_reelle = DATETIME('now')"); }
    params.push(id);
    run(`UPDATE livraisons SET ${fields.join(', ')} WHERE id = ?`, params);
    logAudit(req.user.id, req.user.nom, 'MAJ_LIVRAISON', 'livraison', id, `Statut: ${statut}`);
    res.json({ success: true });
}));

module.exports = router;
