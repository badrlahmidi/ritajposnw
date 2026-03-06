/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Middleware centralisés
 *  - errorHandler : gestion globale des erreurs
 *  - asyncHandler : wrapper pour éviter les try/catch répétitifs
 *  - requestLogger : log structuré des requêtes
 * ═══════════════════════════════════════════════════════════════
 */
const logger = require('./logger');

/**
 * Wrapper pour les routes async — capture automatiquement les erreurs
 * et les passe à next() au lieu de nécessiter try/catch dans chaque route.
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware de logging des requêtes HTTP
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    };
    if (req.user) logData.user = req.user.login;

    if (res.statusCode >= 500) {
      logger.error(logData, 'Erreur serveur');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Requête échouée');
    } else if (duration > 1000) {
      logger.warn(logData, 'Requête lente');
    }
    // Les requêtes normales ne sont pas loguées pour éviter le bruit (sauf en debug)
    else {
      logger.debug(logData, 'Requête traitée');
    }
  });
  next();
}

/**
 * Middleware global de gestion des erreurs.
 * Doit être enregistré APRÈS toutes les routes : app.use(errorHandler)
 */
function errorHandler(err, req, res, _next) {
  // Log structuré de l'erreur
  logger.error({
    err: {
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      code: err.code,
    },
    method: req.method,
    url: req.originalUrl,
    user: req.user ? req.user.login : 'anonymous',
  }, 'Erreur non gérée');

  // Déterminer le code de statut
  const statusCode = err.statusCode || err.status || 500;

  // Réponse JSON
  const response = {
    error: err.message || 'Erreur interne du serveur',
  };

  // En développement, inclure la stack trace
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

const jwt = require('jsonwebtoken');
const config = require('./config');
const { JWT_SECRET } = config;

/**
 * Verification du Token JWT
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = req.query && req.query.token;
  if (!header && !queryToken) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    const token = queryToken || (header && header.startsWith('Bearer ') ? header.split(' ')[1] : null);
    if (!token) return res.status(401).json({ error: 'Token invalide' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
    return res.status(403).json({ error: 'Accès réservé admin/manager' });
  }
  next();
}

function adminStrict(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé admin' });
  }
  next();
}

module.exports = { asyncHandler, requestLogger, errorHandler, authMiddleware, adminOnly, adminStrict };
