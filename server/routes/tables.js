/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Tables & Salles
 *  Gestion du plan de salle : salles, tables, statuts.
 *
 *  Monté sur : /api/tables
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit } = require('../db');
const { broadcast } = require('../services/realtime');
const { ok, fail } = require('../utils/response');

// ─── Salles ──────────────────────────────────────────────────────────────────

/** GET /api/tables/salles — liste salles + tables avec statuts */
router.get('/salles', authMiddleware, asyncHandler((req, res) => {
  const salles = queryAll('SELECT * FROM salles ORDER BY ordre, id');
  const tables = queryAll('SELECT * FROM tables ORDER BY salle_id, numero');

  const result = salles.map(salle => ({
    ...salle,
    tables: tables.filter(t => t.salle_id === salle.id),
  }));

  // Tables sans salle
  const orphans = tables.filter(t => t.salle_id === null);
  if (orphans.length) result.push({ id: null, nom: 'Sans salle', ordre: 999, tables: orphans });

  return ok(res, result);
}));

/** POST /api/tables/salles — créer une salle */
router.post('/salles', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { nom, ordre = 0 } = req.body;
  if (!nom) return fail(res, 400, 'MISSING_NOM', 'Le nom de la salle est requis');

  const result = run('INSERT INTO salles (nom, ordre) VALUES (?, ?)', [nom.trim(), ordre]);
  const salle = queryOne('SELECT * FROM salles WHERE id = ?', [result.lastInsertRowid]);
  broadcast('salle.created', salle);
  return ok(res, salle, 201);
}));

/** PUT /api/tables/salles/:id — modifier une salle */
router.put('/salles/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { id } = req.params;
  const { nom, ordre } = req.body;
  if (!nom) return fail(res, 400, 'MISSING_NOM', 'Le nom de la salle est requis');

  run('UPDATE salles SET nom = ?, ordre = ? WHERE id = ?', [nom.trim(), ordre ?? 0, id]);
  const salle = queryOne('SELECT * FROM salles WHERE id = ?', [id]);
  if (!salle) return fail(res, 404, 'SALLE_NOT_FOUND', 'Salle introuvable');
  broadcast('salle.updated', salle);
  return ok(res, salle);
}));

/** DELETE /api/tables/salles/:id — supprimer une salle */
router.delete('/salles/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { id } = req.params;
  run('UPDATE tables SET salle_id = NULL WHERE salle_id = ?', [id]);
  run('DELETE FROM salles WHERE id = ?', [id]);
  broadcast('salle.deleted', { id: Number(id) });
  return ok(res, { id: Number(id) });
}));

// ─── Tables ──────────────────────────────────────────────────────────────────

/** GET /api/tables — liste toutes les tables avec commande active */
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const tables = queryAll(`
    SELECT t.*,
      c.id AS commande_id,
      c.nb_couverts,
      c.statut_service,
      c.total_ttc
    FROM tables t
    LEFT JOIN commandes c ON c.table_id = t.id
      AND c.statut_service IN ('ouverte','envoyee_cuisine','servie')
    ORDER BY t.salle_id, t.numero
  `);
  return ok(res, tables);
}));

/** POST /api/tables — créer une table */
router.post('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { salle_id = null, numero, capacite = 4, x = 0, y = 0 } = req.body;
  if (!numero) return fail(res, 400, 'MISSING_NUMERO', 'Le numéro de table est requis');

  const result = run(
    'INSERT INTO tables (salle_id, numero, capacite, x, y) VALUES (?, ?, ?, ?, ?)',
    [salle_id, String(numero), capacite, x, y]
  );
  const table = queryOne('SELECT * FROM tables WHERE id = ?', [result.lastInsertRowid]);
  broadcast('table.created', table);
  return ok(res, table, 201);
}));

/** PUT /api/tables/:id — modifier une table (position, capacité, salle) */
router.put('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { id } = req.params;
  const { salle_id, numero, capacite, x, y } = req.body;

  const existing = queryOne('SELECT * FROM tables WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'TABLE_NOT_FOUND', 'Table introuvable');

  run(
    'UPDATE tables SET salle_id=?, numero=?, capacite=?, x=?, y=? WHERE id=?',
    [
      salle_id ?? existing.salle_id,
      numero ?? existing.numero,
      capacite ?? existing.capacite,
      x ?? existing.x,
      y ?? existing.y,
      id,
    ]
  );
  const table = queryOne('SELECT * FROM tables WHERE id = ?', [id]);
  broadcast('table.updated', table);
  return ok(res, table);
}));

/** PATCH /api/tables/:id/statut — changer le statut d'une table */
router.patch('/:id/statut', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  const VALID = ['libre', 'occupee', 'reservee', 'a_nettoyer'];
  if (!VALID.includes(statut)) {
    return fail(res, 400, 'INVALID_STATUT', `Statut invalide. Valeurs acceptées : ${VALID.join(', ')}`);
  }

  const existing = queryOne('SELECT * FROM tables WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'TABLE_NOT_FOUND', 'Table introuvable');

  run('UPDATE tables SET statut = ? WHERE id = ?', [statut, id]);
  broadcast('table.updated', { id: Number(id), statut });
  return ok(res, { id: Number(id), statut });
}));

/** DELETE /api/tables/:id — supprimer une table */
router.delete('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM tables WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'TABLE_NOT_FOUND', 'Table introuvable');

  run('UPDATE commandes SET table_id = NULL WHERE table_id = ?', [id]);
  run('DELETE FROM tables WHERE id = ?', [id]);
  broadcast('table.deleted', { id: Number(id) });
  return ok(res, { id: Number(id) });
}));

module.exports = router;
