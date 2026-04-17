/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Utilitaires réponse API standardisée
 *  Toutes les réponses suivent le format :
 *    { success: true, data: {...} }
 *    { success: false, error: { code, message } }
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Réponse succès
 * @param {import('express').Response} res
 * @param {*} data
 * @param {number} [status=200]
 */
function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

/**
 * Réponse erreur
 * @param {import('express').Response} res
 * @param {number} status  Code HTTP (400, 401, 403, 404, 409, 500…)
 * @param {string} code    Code machine lisible (ex: 'PROFILE_NOT_FOUND')
 * @param {string} message Message lisible par l'utilisateur
 */
function fail(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

module.exports = { ok, fail };
