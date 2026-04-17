/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Afficheur Client (2e écran)
 *  Sert la page HTML de l'afficheur et expose l'API d'état.
 *
 *  Monté sur : /api/afficheur
 *
 *  Endpoints :
 *    GET /api/afficheur/etat        — état actuel (ticket en cours)
 *    POST /api/afficheur/message    — afficher un message custom
 *    POST /api/afficheur/ticket     — pousser un ticket vers l'afficheur
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryOne, queryAll } = require('../db');
const { ok, fail } = require('../utils/response');
const { broadcast } = require('../services/realtime');

// État en mémoire de l'afficheur
let _displayState = {
  mode: 'idle',             // 'idle' | 'ticket' | 'message' | 'payment'
  message: null,            // Message personnalisé
  commande: null,           // Ticket en cours
  total: null,              // Montant total
  updated_at: null,
};

/**
 * GET /api/afficheur/etat
 * L'afficheur client (customer-display.html) poll cet endpoint.
 */
router.get('/etat', (req, res) => {
  return ok(res, _displayState);
});

/**
 * POST /api/afficheur/message
 * Afficher un message de bienvenue ou promotion sur l'écran client.
 * Body: { message, duration_ms? }
 */
router.post('/message', authMiddleware, asyncHandler((req, res) => {
  const { message, duration_ms = 10000 } = req.body;
  if (!message) return fail(res, 400, 'MISSING_MESSAGE', 'Message requis');

  // Plafonner la durée pour éviter les timers excessivement longs (max 5 min)
  const MAX_DURATION_MS = 300_000;
  const safeDuration = Math.min(Math.max(0, Number(duration_ms) || 0), MAX_DURATION_MS);

  _displayState = {
    mode: 'message',
    message,
    commande: null,
    total: null,
    updated_at: new Date().toISOString(),
  };

  broadcast('display.updated', _displayState);

  // Retour en idle après safeDuration
  if (safeDuration > 0) {
    setTimeout(() => {
      _displayState = { mode: 'idle', message: null, commande: null, total: null, updated_at: new Date().toISOString() };
      broadcast('display.updated', _displayState);
    }, safeDuration);
  }

  return ok(res, _displayState);
}));

/**
 * POST /api/afficheur/ticket
 * Pousse le ticket en cours vers l'afficheur client.
 * Body: { commande_id } ou { lignes, total, mode: 'payment' }
 */
router.post('/ticket', authMiddleware, asyncHandler((req, res) => {
  const { commande_id, lignes, total, mode = 'ticket' } = req.body;

  if (commande_id) {
    const commande = queryOne(`
      SELECT c.id, c.numero, c.total_ttc AS total, c.statut_service,
             t.numero AS table_numero
      FROM commandes c
      LEFT JOIN tables t ON t.id = c.table_id
      WHERE c.id = ?
    `, [commande_id]);

    if (!commande) return fail(res, 404, 'COMMANDE_NOT_FOUND', 'Commande introuvable');

    commande.lignes = queryAll(`
      SELECT cl.quantite, cl.prix_unitaire, cl.total_ligne, p.nom AS produit_nom
      FROM commande_lignes cl
      LEFT JOIN produits p ON p.id = cl.produit_id
      WHERE cl.commande_id = ?
    `, [commande_id]);

    _displayState = {
      mode,
      message: null,
      commande,
      total: commande.total,
      updated_at: new Date().toISOString(),
    };
  } else {
    // Mode direct sans commande_id
    _displayState = {
      mode,
      message: null,
      commande: { lignes: lignes || [] },
      total: total || 0,
      updated_at: new Date().toISOString(),
    };
  }

  broadcast('display.updated', _displayState);
  return ok(res, _displayState);
}));

/**
 * POST /api/afficheur/reset
 * Remet l'afficheur en mode idle (écran de bienvenue).
 */
router.post('/reset', authMiddleware, (req, res) => {
  _displayState = {
    mode: 'idle',
    message: null,
    commande: null,
    total: null,
    updated_at: new Date().toISOString(),
  };
  broadcast('display.updated', _displayState);
  return ok(res, _displayState);
});

module.exports = router;
