/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Balance Série
 *  Driver optionnel pour balances au poids (buffet, épicerie fine).
 *
 *  Monté sur : /api/balance
 *
 *  Endpoints :
 *    GET  /api/balance/poids       — lire poids actuel
 *    GET  /api/balance/poids/live  — lire avec commande pull
 *    GET  /api/balance/statut      — état connexion balance
 *    GET  /api/balance/ports       — lister ports série disponibles
 *    POST /api/balance/connecter   — connecter à la balance
 *    POST /api/balance/deconnecter — déconnecter
 *    GET  /api/balance/config      — config actuelle
 *    PUT  /api/balance/config      — mettre à jour config
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { run, queryAll } = require('../db');
const { ok, fail } = require('../utils/response');
const scaleService = require('../services/scale.service');

// ─── Lire le poids ────────────────────────────────────────────────────────────

/**
 * GET /api/balance/poids
 * Retourne la valeur mise en cache depuis le flux série.
 */
router.get('/poids', authMiddleware, (req, res) => {
  const weight = scaleService.getCurrentWeight();
  return ok(res, weight);
});

/**
 * GET /api/balance/poids/live
 * Demande activement le poids à la balance et attend la réponse (max 3s).
 * Utile pour les balances en mode pull (MT-SICS).
 */
router.get('/poids/live', authMiddleware, asyncHandler(async (req, res) => {
  const weight = await scaleService.requestWeight();
  return ok(res, weight);
}));

// ─── Statut ───────────────────────────────────────────────────────────────────

/**
 * GET /api/balance/statut
 */
router.get('/statut', authMiddleware, (req, res) => {
  return ok(res, scaleService.getStatus());
});

// ─── Ports disponibles ────────────────────────────────────────────────────────

/**
 * GET /api/balance/ports
 * Liste les ports série détectés sur le système.
 */
router.get('/ports', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const ports = await scaleService.listPorts();
  return ok(res, ports);
}));

// ─── Connexion ────────────────────────────────────────────────────────────────

/**
 * POST /api/balance/connecter
 * Body: { port?, baudrate?, protocol?, unit? }
 * Si le body est vide, utilise la config sauvegardée en DB.
 */
router.post('/connecter', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  let cfg = { ...req.body };

  // Si pas de config dans le body, charger depuis la DB
  if (!cfg.port) {
    try {
      const rows = queryAll("SELECT cle, valeur FROM parametres WHERE cle LIKE 'balance_%'");
      const dbCfg = Object.fromEntries(rows.map(r => [r.cle.replace('balance_', ''), r.valeur]));
      cfg = { ...dbCfg, ...cfg };
    } catch { /* silent */ }
  }

  if (!cfg.port) {
    return fail(res, 400, 'MISSING_PORT', 'Port série requis (ex: /dev/ttyUSB0 ou COM3)');
  }

  const success = await scaleService.connect(cfg);
  const status = scaleService.getStatus();

  if (!success && !status.simulation) {
    return fail(res, 503, 'SCALE_CONNECT_ERROR', 'Impossible de se connecter à la balance');
  }

  return ok(res, { message: success ? 'Balance connectée' : 'Mode simulation', ...status });
}));

/**
 * POST /api/balance/deconnecter
 */
router.post('/deconnecter', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await scaleService.disconnect();
  return ok(res, { message: 'Balance déconnectée' });
}));

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * GET /api/balance/config
 */
router.get('/config', authMiddleware, adminOnly, asyncHandler((req, res) => {
  let cfg = {};
  try {
    const rows = queryAll("SELECT cle, valeur FROM parametres WHERE cle LIKE 'balance_%'");
    cfg = Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
  } catch { /* pas encore configuré */ }
  return ok(res, cfg);
}));

/**
 * PUT /api/balance/config
 * Body: { port?, baudrate?, protocol?, unit? }
 */
router.put('/config', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { port, baudrate, protocol, unit } = req.body;

  const VALID_PROTOCOLS = ['cas', 'mt-sics', 'ohaus', 'generic'];
  if (protocol && !VALID_PROTOCOLS.includes(protocol)) {
    return fail(res, 400, 'INVALID_PROTOCOL',
      `Protocole invalide. Valeurs : ${VALID_PROTOCOLS.join(', ')}`);
  }

  const VALID_UNITS = ['kg', 'g'];
  if (unit && !VALID_UNITS.includes(unit)) {
    return fail(res, 400, 'INVALID_UNIT', `Unité invalide. Valeurs : ${VALID_UNITS.join(', ')}`);
  }

  const upsert = (cle, valeur) => {
    if (valeur === undefined) return;
    try {
      run(
        "INSERT INTO parametres (cle, valeur) VALUES (?,?) ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur",
        [cle, valeur]
      );
    } catch {
      try {
        run("UPDATE parametres SET valeur=? WHERE cle=?", [valeur, cle]);
        run("INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?,?)", [cle, valeur]);
      } catch { /* silent */ }
    }
  };

  if (port)      upsert('balance_port', port);
  if (baudrate)  upsert('balance_baudrate', String(baudrate));
  if (protocol)  upsert('balance_protocol', protocol);
  if (unit)      upsert('balance_unit', unit);

  return ok(res, { message: 'Configuration balance mise à jour' });
}));

module.exports = router;
