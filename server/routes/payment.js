/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Terminal de Paiement CMI
 *  Intégration CMI (Centre Monétique Interbancaire) Maroc
 *  + mode manuel (montant affiché, validation opérateur)
 *
 *  Monté sur : /api/paiement
 *
 *  Endpoints :
 *    POST /api/paiement/initier       — démarrer un paiement
 *    POST /api/paiement/valider       — valider manuellement
 *    GET  /api/paiement/statut/:oid   — vérifier statut CMI
 *    POST /api/paiement/callback      — webhook CMI (pas d'auth)
 *    GET  /api/paiement/config        — lire config CMI
 *    PUT  /api/paiement/config        — mettre à jour config CMI
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryOne, run, logAudit } = require('../db');
const { ok, fail } = require('../utils/response');
const { broadcast } = require('../services/realtime');
const {
  initPayment,
  checkPaymentStatus,
  validateManualPayment,
} = require('../services/payment.service');

// ─── Initier un paiement ──────────────────────────────────────────────────────

/**
 * POST /api/paiement/initier
 * Body: { commande_id, montant, mode, ok_url?, fail_url? }
 */
router.post('/initier', authMiddleware, asyncHandler(async (req, res) => {
  const { commande_id, montant, mode = 'carte', ok_url, fail_url } = req.body;

  if (!commande_id) return fail(res, 400, 'MISSING_COMMANDE', 'commande_id requis');
  if (!montant || isNaN(montant) || Number(montant) <= 0) {
    return fail(res, 400, 'INVALID_MONTANT', 'Montant invalide');
  }

  const commande = queryOne('SELECT id, numero, total_ttc, statut FROM commandes WHERE id = ?', [commande_id]);
  if (!commande) return fail(res, 404, 'COMMANDE_NOT_FOUND', 'Commande introuvable');

  const result = await initPayment({ commande_id, montant, mode, ok_url, fail_url });

  logAudit(
    req.user.id, req.user.nom,
    'PAIEMENT_INITIE', 'commande', Number(commande_id),
    `Mode: ${mode}, Montant: ${montant} MAD`
  );

  return ok(res, result);
}));

// ─── Valider manuellement ─────────────────────────────────────────────────────

/**
 * POST /api/paiement/valider
 * Body: { commande_id, montant, mode, reference? }
 * Utilisé quand le terminal ne retourne pas de callback (mode manuel)
 */
router.post('/valider', authMiddleware, asyncHandler((req, res) => {
  const { commande_id, montant, mode = 'especes', reference } = req.body;

  if (!commande_id) return fail(res, 400, 'MISSING_COMMANDE', 'commande_id requis');
  if (!montant || isNaN(montant)) return fail(res, 400, 'INVALID_MONTANT', 'Montant invalide');

  const commande = queryOne('SELECT * FROM commandes WHERE id = ?', [commande_id]);
  if (!commande) return fail(res, 404, 'COMMANDE_NOT_FOUND', 'Commande introuvable');

  const paiement = validateManualPayment({
    commande_id,
    montant,
    mode,
    reference,
    caissier_id: req.user.id,
  });

  logAudit(
    req.user.id, req.user.nom,
    'PAIEMENT_VALIDE', 'commande', Number(commande_id),
    `Mode: ${mode}, Montant: ${montant} MAD, Réf: ${reference || 'N/A'}`
  );

  broadcast('commande.paiement', { commande_id: Number(commande_id), paiement });

  return ok(res, paiement);
}));

// ─── Vérifier statut CMI ──────────────────────────────────────────────────────

/**
 * GET /api/paiement/statut/:oid
 */
router.get('/statut/:oid', authMiddleware, asyncHandler(async (req, res) => {
  const { oid } = req.params;
  const result = await checkPaymentStatus(oid);
  return ok(res, result);
}));

// ─── Webhook CMI (callback) ───────────────────────────────────────────────────

/**
 * POST /api/paiement/callback
 * Reçu par CMI après paiement (pas d'auth JWT — IP whitelist recommandée en prod)
 * Body urlencoded: { oid, Response, mdStatus, amount, ... }
 */
router.post('/callback', asyncHandler(async (req, res) => {
  const body = req.body;
  const oid   = body.oid || '';
  const approved = body.Response === 'Approved' || body.mdStatus === '1';

  // Retrouver la commande depuis l'OID (format RITAJ-{id}-{ts})
  const match = oid.match(/^RITAJ-(\d+)-/);
  if (match) {
    const commande_id = Number(match[1]);
    if (approved) {
      // Marquer le paiement comme validé
      try {
        run(
          "UPDATE commandes SET statut='encaissee', statut_service='encaissee' WHERE id=?",
          [commande_id]
        );
      } catch { /* silent */ }
      broadcast('commande.encaissee', { commande_id, oid, mode: 'carte' });
    } else {
      broadcast('commande.paiement_refuse', { commande_id, oid, reason: body.ErrMsg || 'Refusé' });
    }
  }

  // CMI attend "ACTION=POSTAUTH" en réponse pour confirmer réception
  res.set('Content-Type', 'text/plain');
  return res.send('ACTION=POSTAUTH');
}));

// ─── Configuration CMI ────────────────────────────────────────────────────────

/**
 * GET /api/paiement/config
 * Retourne la config CMI (masque la clé secrète)
 */
router.get('/config', authMiddleware, adminOnly, asyncHandler((req, res) => {
  let cfg = {};
  try {
    const rows = require('../db').queryAll(
      "SELECT cle, valeur FROM parametres WHERE cle LIKE 'paiement_cmi%'"
    );
    cfg = Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
    // Masquer la clé secrète
    if (cfg.paiement_cmi_store_key) {
      cfg.paiement_cmi_store_key = '***MASQUÉE***';
    }
  } catch { /* pas encore configuré */ }
  return ok(res, cfg);
}));

/**
 * PUT /api/paiement/config
 * Body: { mode, merchant?, store_key?, endpoint? }
 */
router.put('/config', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { mode, merchant, store_key, endpoint } = req.body;

  const VALID_MODES = ['manual', 'cmi'];
  if (mode && !VALID_MODES.includes(mode)) {
    return fail(res, 400, 'INVALID_MODE', `Mode invalide. Valeurs : ${VALID_MODES.join(', ')}`);
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

  if (mode)      upsert('paiement_cmi_mode', mode);
  if (merchant)  upsert('paiement_cmi_merchant', merchant);
  if (store_key) upsert('paiement_cmi_store_key', store_key);
  if (endpoint)  upsert('paiement_cmi_endpoint', endpoint);

  logAudit(req.user.id, req.user.nom, 'CONFIG_PAIEMENT', 'parametres', null,
    `Mode CMI mis à jour: ${mode || 'inchangé'}`);

  return ok(res, { message: 'Configuration CMI mise à jour' });
}));

module.exports = router;
