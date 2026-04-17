/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Impression ESC/POS
 *  Gestion imprimantes thermiques et tiroir-caisse.
 *
 *  Monté sur : /api/print
 *
 *  Endpoints :
 *    POST /api/print/ticket/:commande_id   — ticket de caisse
 *    POST /api/print/cuisine/:commande_id  — ticket cuisine/bar
 *    POST /api/print/test                  — page de test
 *    POST /api/print/tiroir                — ouvre le tiroir-caisse
 *    GET  /api/print/imprimantes           — liste imprimantes
 *    POST /api/print/imprimantes           — ajouter une imprimante
 *    PUT  /api/print/imprimantes/:id       — modifier
 *    DELETE /api/print/imprimantes/:id     — supprimer
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit } = require('../db');
const { ok, fail } = require('../utils/response');
const {
  printTicket, printKitchen, openDrawer, testPrint,
} = require('../services/printing.service');

// ─── Ticket de caisse ─────────────────────────────────────────────────────────

/**
 * POST /api/print/ticket/:commande_id
 * Body: { open_drawer?: bool }
 */
router.post('/ticket/:commande_id', authMiddleware, asyncHandler(async (req, res) => {
  const { commande_id } = req.params;
  const { open_drawer = false } = req.body;

  const commande = queryOne(`
    SELECT c.*, t.numero AS table_numero, u.nom AS serveur_nom
    FROM commandes c
    LEFT JOIN tables t ON t.id = c.table_id
    LEFT JOIN utilisateurs u ON u.id = c.serveur_id
    WHERE c.id = ?
  `, [commande_id]);
  if (!commande) return fail(res, 404, 'COMMANDE_NOT_FOUND', 'Commande introuvable');

  commande.lignes = queryAll(`
    SELECT cl.*, p.nom AS produit_nom
    FROM commande_lignes cl
    LEFT JOIN produits p ON p.id = cl.produit_id
    WHERE cl.commande_id = ?
  `, [commande_id]);

  // Paiements si disponibles
  try {
    commande.paiements = queryAll('SELECT * FROM paiements WHERE commande_id = ?', [commande_id]);
  } catch { commande.paiements = []; }

  const result = await printTicket(commande, { openDrawer: open_drawer, cutPaper: true });

  if (open_drawer) {
    logAudit(req.user.id, req.user.nom, 'OUVERTURE_TIROIR', 'commande', Number(commande_id), 'Tiroir ouvert via impression ticket');
  }

  if (!result.success) return fail(res, 503, 'PRINT_ERROR', result.message);
  return ok(res, result);
}));

// ─── Ticket cuisine ───────────────────────────────────────────────────────────

/**
 * POST /api/print/cuisine/:commande_id
 * Body: { cours?: 'entree'|'plat'|'dessert'|'boisson' }
 */
router.post('/cuisine/:commande_id', authMiddleware, asyncHandler(async (req, res) => {
  const { commande_id } = req.params;
  const { cours = null } = req.body;

  const commande = queryOne(`
    SELECT c.*, t.numero AS table_numero
    FROM commandes c
    LEFT JOIN tables t ON t.id = c.table_id
    WHERE c.id = ?
  `, [commande_id]);
  if (!commande) return fail(res, 404, 'COMMANDE_NOT_FOUND', 'Commande introuvable');

  commande.lignes = queryAll(`
    SELECT cl.*, p.nom AS produit_nom, p.categorie_id
    FROM commande_lignes cl
    LEFT JOIN produits p ON p.id = cl.produit_id
    WHERE cl.commande_id = ?
  `, [commande_id]);

  const result = await printKitchen(commande, cours);
  if (!result.success) return fail(res, 503, 'PRINT_ERROR', result.message || 'Échec impression cuisine');
  return ok(res, result);
}));

// ─── Ouvrir tiroir-caisse ─────────────────────────────────────────────────────

/**
 * POST /api/print/tiroir
 * Ouvre le tiroir-caisse sans imprimer de ticket.
 */
router.post('/tiroir', authMiddleware, asyncHandler(async (req, res) => {
  const result = await openDrawer();
  logAudit(req.user.id, req.user.nom, 'OUVERTURE_TIROIR', 'caisse', null, 'Ouverture manuelle du tiroir');
  if (!result.success) return fail(res, 503, 'DRAWER_ERROR', result.message);
  return ok(res, result);
}));

// ─── Page de test ─────────────────────────────────────────────────────────────

/**
 * POST /api/print/test
 * Body: { ip, port? }
 */
router.post('/test', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { ip, port = 9100 } = req.body;
  if (!ip) return fail(res, 400, 'MISSING_IP', 'L\'adresse IP de l\'imprimante est requise');

  const result = await testPrint(ip, port);
  if (!result.success) return fail(res, 503, 'PRINT_ERROR', result.message);
  return ok(res, result);
}));

// ─── CRUD Imprimantes ─────────────────────────────────────────────────────────

/**
 * GET /api/print/imprimantes
 */
router.get('/imprimantes', authMiddleware, asyncHandler((req, res) => {
  const list = queryAll('SELECT * FROM imprimantes ORDER BY type, nom');
  return ok(res, list);
}));

/**
 * POST /api/print/imprimantes
 * Body: { nom, type, ip, port?, categories_json?, actif? }
 */
router.post('/imprimantes', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { nom, type, ip, port = 9100, categories_json = null, actif = 1 } = req.body;

  if (!nom) return fail(res, 400, 'MISSING_NOM', 'Le nom est requis');
  if (!type) return fail(res, 400, 'MISSING_TYPE', 'Le type est requis');
  if (!ip)   return fail(res, 400, 'MISSING_IP', 'L\'adresse IP est requise');

  const VALID_TYPES = ['ticket', 'cuisine', 'bar'];
  if (!VALID_TYPES.includes(type)) {
    return fail(res, 400, 'INVALID_TYPE', `Type invalide. Valeurs : ${VALID_TYPES.join(', ')}`);
  }

  const result = run(
    'INSERT INTO imprimantes (nom, type, ip, port, categories_json, actif) VALUES (?,?,?,?,?,?)',
    [nom.trim(), type, ip.trim(), port, categories_json, actif ? 1 : 0]
  );
  const imp = queryOne('SELECT * FROM imprimantes WHERE id = ?', [result.lastInsertRowid]);
  return ok(res, imp, 201);
}));

/**
 * PUT /api/print/imprimantes/:id
 */
router.put('/imprimantes/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM imprimantes WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'PRINTER_NOT_FOUND', 'Imprimante introuvable');

  const { nom, type, ip, port, categories_json, actif } = req.body;

  const VALID_TYPES = ['ticket', 'cuisine', 'bar'];
  if (type && !VALID_TYPES.includes(type)) {
    return fail(res, 400, 'INVALID_TYPE', `Type invalide. Valeurs : ${VALID_TYPES.join(', ')}`);
  }

  run(
    'UPDATE imprimantes SET nom=?, type=?, ip=?, port=?, categories_json=?, actif=? WHERE id=?',
    [
      nom ?? existing.nom,
      type ?? existing.type,
      ip ?? existing.ip,
      port ?? existing.port,
      categories_json !== undefined ? categories_json : existing.categories_json,
      actif !== undefined ? (actif ? 1 : 0) : existing.actif,
      id,
    ]
  );
  const imp = queryOne('SELECT * FROM imprimantes WHERE id = ?', [id]);
  return ok(res, imp);
}));

/**
 * DELETE /api/print/imprimantes/:id
 */
router.delete('/imprimantes/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM imprimantes WHERE id = ?', [id]);
  if (!existing) return fail(res, 404, 'PRINTER_NOT_FOUND', 'Imprimante introuvable');
  run('DELETE FROM imprimantes WHERE id = ?', [id]);
  return ok(res, { id: Number(id) });
}));

module.exports = router;
