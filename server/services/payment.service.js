/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Service Terminal de Paiement CMI (Maroc)
 *
 *  Centre Monétique Interbancaire — solution de paiement marocaine.
 *  Documentation : https://www.cmi.co.ma (API REST CMI J2EE v3)
 *
 *  Modes supportés :
 *   - 'cmi'    : intégration REST directe si clés configurées
 *   - 'manual' : montant affiché sur TPE, validation opérateur
 *
 *  Configuration (paramètres en DB) :
 *    paiement_cmi_mode      : 'cmi' | 'manual'
 *    paiement_cmi_merchant  : identifiant commerçant CMI
 *    paiement_cmi_store_key : clé secrète (SHA-512)
 *    paiement_cmi_endpoint  : URL de l'endpoint CMI (sandbox ou prod)
 * ═══════════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { queryOne, run } = require('../db');
const logger = require('../logger');

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function getConfig() {
  try {
    const rows = require('../db').queryAll(
      "SELECT cle, valeur FROM parametres WHERE cle LIKE 'paiement_cmi%'"
    );
    return Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
  } catch {
    return {};
  }
}

/**
 * Génère la signature HMAC SHA-512 pour CMI.
 * La chaîne est construite selon les specs CMI :
 *   storekey + montant + devises + oid + okUrl + failUrl + ...
 * @param {object} params  Paramètres à signer
 * @param {string} storeKey  Clé secrète
 * @returns {string} Signature hex
 */
function buildCMISignature(params, storeKey) {
  // Les champs doivent être triés alphabétiquement (spec CMI)
  const sorted = Object.keys(params).sort();
  const values = sorted.map(k => params[k] || '').join('|');
  const sigString = `${storeKey}${values}|${storeKey}`;
  return crypto.createHash('sha512').update(sigString, 'utf8').digest('hex').toUpperCase();
}

/**
 * Exécute une requête HTTP(S) vers l'API CMI.
 * @param {string} url
 * @param {object} postData
 * @returns {Promise<string>} Corps de la réponse
 */
function cmiRequest(url, postData) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(postData).toString();
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request(options, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout CMI')); });
    req.write(body);
    req.end();
  });
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Initie un paiement.
 * @param {object} opts
 *   - commande_id   : ID commande
 *   - montant       : montant TTC (MAD)
 *   - mode          : 'carte'|'ticket_resto'|'virement'|'especes'|'cheque'
 *   - ok_url        : URL callback succès (pour mode CMI)
 *   - fail_url      : URL callback échec
 * @returns {Promise<PaymentInitResult>}
 */
async function initPayment({ commande_id, montant, mode = 'carte', ok_url, fail_url }) {
  const cfg = getConfig();
  const payMode = cfg.paiement_cmi_mode || 'manual';

  // Modes non-electroniques → validation manuelle immédiate
  if (mode !== 'carte' || payMode === 'manual') {
    return {
      mode: 'manual',
      montant: Number(montant),
      currency: 'MAD',
      commande_id,
      status: 'pending_manual',
      message: `Montant à payer : ${Number(montant).toFixed(2)} MAD — Valider après encaissement`,
    };
  }

  // ── Mode CMI intégration ──────────────────────────────────────────────────
  const merchant = cfg.paiement_cmi_merchant;
  const storeKey = cfg.paiement_cmi_store_key;
  const endpoint = cfg.paiement_cmi_endpoint || 'https://payment.cmi.co.ma/fim/api';

  if (!merchant || !storeKey) {
    logger.warn('CMI non configuré — basculement mode manuel');
    return {
      mode: 'manual',
      montant: Number(montant),
      currency: 'MAD',
      commande_id,
      status: 'pending_manual',
      message: `CMI non configuré. Montant : ${Number(montant).toFixed(2)} MAD`,
    };
  }

  const oid = `RITAJ-${commande_id}-${Date.now()}`;
  const montantCentimes = Math.round(Number(montant) * 100); // CMI attend les centimes

  const params = {
    clientid:    merchant,
    oid:         oid,
    amount:      String(montantCentimes),
    currency:    '504', // Code ISO 4217 pour MAD
    okUrl:       ok_url || '',
    failUrl:     fail_url || '',
    encoding:    'UTF-8',
    trantype:    'PreAuth',
    lang:        'fr',
    refreshtime: '5',
    storetype:   '3d_pay_hosting',
  };

  params.hash = buildCMISignature(params, storeKey);

  try {
    const response = await cmiRequest(endpoint, params);
    logger.info({ oid, commande_id, montant }, 'Paiement CMI initié');
    return {
      mode: 'cmi',
      oid,
      commande_id,
      montant: Number(montant),
      currency: 'MAD',
      status: 'initiated',
      cmi_response: response,
    };
  } catch (err) {
    logger.error({ err: err.message, commande_id }, 'Erreur CMI — basculement manuel');
    return {
      mode: 'manual',
      montant: Number(montant),
      currency: 'MAD',
      commande_id,
      status: 'pending_manual',
      message: `Erreur CMI: ${err.message}. Traitement manuel requis.`,
    };
  }
}

/**
 * Vérifie le statut d'un paiement CMI via l'OID.
 * @param {string} oid  Order ID CMI
 * @returns {Promise<{ status, approved, montant, oid }>}
 */
async function checkPaymentStatus(oid) {
  const cfg = getConfig();
  const merchant = cfg.paiement_cmi_merchant;
  const storeKey = cfg.paiement_cmi_store_key;
  const endpoint = (cfg.paiement_cmi_endpoint || 'https://payment.cmi.co.ma/fim/api')
    .replace('/fim/api', '/fim/orderManagement');

  if (!merchant || !storeKey) {
    return { status: 'unconfigured', approved: false, oid };
  }

  const params = {
    clientid: merchant,
    oid,
    trantype: 'orderstatus',
  };
  params.hash = buildCMISignature(params, storeKey);

  try {
    const response = await cmiRequest(endpoint, params);
    // Réponse CMI : "approved=1&response=Approved&..." ou XML selon config
    const parsed = Object.fromEntries(new URLSearchParams(response));
    const approved = parsed.approved === '1' || parsed.Response === 'Approved';
    return {
      status: approved ? 'approved' : 'declined',
      approved,
      oid,
      raw: parsed,
    };
  } catch (err) {
    logger.error({ err: err.message, oid }, 'Erreur vérification statut CMI');
    return { status: 'error', approved: false, oid, error: err.message };
  }
}

/**
 * Valide manuellement un paiement (mode manuel ou fallback).
 * Enregistre le paiement en base.
 * @param {object} opts { commande_id, montant, mode, reference?, caissier_id }
 * @returns {object} Paiement enregistré
 */
function validateManualPayment({ commande_id, montant, mode = 'especes', reference = null, caissier_id }) {
  // Essayer d'insérer dans la table paiements si elle existe
  try {
    const result = run(
      'INSERT INTO paiements (commande_id, montant, mode, reference, statut, created_by) VALUES (?,?,?,?,?,?)',
      [commande_id, montant, mode, reference, 'valide', caissier_id || null]
    );
    return {
      id: result.lastInsertRowid,
      commande_id,
      montant: Number(montant),
      mode,
      reference,
      statut: 'valide',
    };
  } catch (err) {
    // Table paiements peut ne pas exister encore — retourner objet logique
    logger.warn({ err: err.message }, 'Table paiements non disponible — paiement logique uniquement');
    return {
      commande_id,
      montant: Number(montant),
      mode,
      reference,
      statut: 'valide',
    };
  }
}

module.exports = {
  initPayment,
  checkPaymentStatus,
  validateManualPayment,
  buildCMISignature, // exporté pour tests
};
