/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Réservations
 *  CRUD réservations + vue calendrier.
 *
 *  Monté sur : /api/reservations
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryAll, queryOne, run } = require('../db');
const { ok, fail } = require('../utils/response');

/**
 * GET /api/reservations
 * Liste les réservations. Filtrage optionnel par date (?date=YYYY-MM-DD)
 */
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { date } = req.query;
  let reservations;
  if (date) {
    reservations = queryAll(`
      SELECT r.*, t.numero AS table_numero
      FROM reservations r
      LEFT JOIN tables t ON t.id = r.table_id
      WHERE date(r.datetime_resa) = date(?)
      ORDER BY r.datetime_resa ASC
    `, [date]);
  } else {
    reservations = queryAll(`
      SELECT r.*, t.numero AS table_numero
      FROM reservations r
      LEFT JOIN tables t ON t.id = r.table_id
      WHERE r.statut NOT IN ('annulee','terminee')
      ORDER BY r.datetime_resa ASC
      LIMIT 200
    `);
  }
  return ok(res, reservations);
}));

/**
 * GET /api/reservations/:id — détail d'une réservation
 */
router.get('/:id', authMiddleware, asyncHandler((req, res) => {
  const r = queryOne(`
    SELECT r.*, t.numero AS table_numero
    FROM reservations r
    LEFT JOIN tables t ON t.id = r.table_id
    WHERE r.id = ?
  `, [req.params.id]);
  if (!r) return fail(res, 404, 'RESA_NOT_FOUND', 'Réservation introuvable');
  return ok(res, r);
}));

/**
 * POST /api/reservations — créer une réservation
 */
router.post('/', authMiddleware, asyncHandler((req, res) => {
  const { client_id, table_id, datetime_resa, nb_personnes = 2, notes } = req.body;
  if (!datetime_resa) return fail(res, 400, 'MISSING_DATETIME', 'La date/heure est requise');

  const result = run(
    'INSERT INTO reservations (client_id, table_id, datetime_resa, nb_personnes, notes) VALUES (?, ?, ?, ?, ?)',
    [client_id || null, table_id || null, datetime_resa, nb_personnes, notes || null]
  );
  const resa = queryOne('SELECT * FROM reservations WHERE id = ?', [result.lastInsertRowid]);
  return ok(res, resa, 201);
}));

/**
 * PUT /api/reservations/:id — modifier une réservation
 */
router.put('/:id', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'RESA_NOT_FOUND', 'Réservation introuvable');

  const { client_id, table_id, datetime_resa, nb_personnes, notes, statut } = req.body;
  const VALID_STATUT = ['confirmee', 'annulee', 'arrivee', 'terminee'];
  if (statut && !VALID_STATUT.includes(statut)) {
    return fail(res, 400, 'INVALID_STATUT', `Statut invalide. Valeurs : ${VALID_STATUT.join(', ')}`);
  }

  run(
    `UPDATE reservations SET
      client_id     = ?,
      table_id      = ?,
      datetime_resa = ?,
      nb_personnes  = ?,
      notes         = ?,
      statut        = ?
    WHERE id = ?`,
    [
      client_id ?? existing.client_id,
      table_id ?? existing.table_id,
      datetime_resa ?? existing.datetime_resa,
      nb_personnes ?? existing.nb_personnes,
      notes ?? existing.notes,
      statut ?? existing.statut,
      id,
    ]
  );
  const resa = queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
  return ok(res, resa);
}));

/**
 * DELETE /api/reservations/:id — annuler/supprimer
 */
router.delete('/:id', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'RESA_NOT_FOUND', 'Réservation introuvable');
  run("UPDATE reservations SET statut='annulee' WHERE id=?", [id]);
  return ok(res, { id: Number(id), statut: 'annulee' });
}));

module.exports = router;
