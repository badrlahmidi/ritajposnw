/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Serveur v5.0 — Café & Restaurant
 *  Auth JWT + Tables + KDS + Réservations + WebSocket + Sécurité
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./logger');
const { requestLogger, errorHandler } = require('./middleware');
const { getDb, isSetupCompleted } = require('./db');
const { attachWebSocket } = require('./services/realtime');

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const taxesRoutes = require('./routes/taxes');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const invoiceRoutes = require('./routes/invoices');
const deliveryRoutes = require('./routes/deliveries');
const clientsRoutes = require('./routes/clients');
const stockRoutes = require('./routes/stock');
const supplierRoutes = require('./routes/suppliers');
const expenseRoutes = require('./routes/expenses');
const discountRoutes = require('./routes/discounts');
const caisseRoutes = require('./routes/caisse');
const statsRoutes = require('./routes/stats');
const systemRoutes = require('./routes/system'); // Handles setup, params, backup, audit, system
const succursalesRoutes = require('./routes/succursales');
const tablesRoutes = require('./routes/tables');
const kitchenRoutes = require('./routes/kitchen');
const reservationsRoutes = require('./routes/reservations');

const app = express();
const { PORT, BASE_PATH } = config;

// ═══════════════════ MIDDLEWARE ═══════════════════

const corsOptions = config.CORS_ORIGINS.length > 0
  ? { origin: config.CORS_ORIGINS, credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      workerSrc: ["'self'", 'blob:'],
    },
  },
}));
app.use(compression());
app.use(requestLogger);

// Rate limiting global : 300 req/min/IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de requêtes, réessayez dans une minute.' } },
});
app.use(`${BASE_PATH}/api`, globalLimiter);

app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
app.use(BASE_PATH + '/uploads', express.static(path.join(__dirname, 'public/uploads'))); // Explicitly serve uploads

// ═══════════════════ ROUTES ═══════════════════

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/utilisateurs', usersRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/taxes', taxesRoutes);
apiRouter.use('/produits', productsRoutes);
apiRouter.use('/commandes', ordersRoutes);
apiRouter.use('/facture', invoiceRoutes);
apiRouter.use('/livraisons', deliveryRoutes);
apiRouter.use('/clients', clientsRoutes);
apiRouter.use('/stock', stockRoutes);
apiRouter.use('/fournisseurs', supplierRoutes);
apiRouter.use('/depenses', expenseRoutes);
apiRouter.use('/remises', discountRoutes);
apiRouter.use('/caisse', caisseRoutes);
apiRouter.use('/stats', statsRoutes);
apiRouter.use('/succursales', succursalesRoutes);
apiRouter.use('/tables', tablesRoutes);
apiRouter.use('/cuisine', kitchenRoutes);
apiRouter.use('/reservations', reservationsRoutes);

// System routes mount at root of API (handles /setup, /parametres, /system, /backup, /audit)
apiRouter.use('/', systemRoutes);

// ═══════════════════ FALLBACK & ERRORS ═══════════════════

app.use(`${BASE_PATH}/api`, apiRouter);

// Set proper fallback for the SPA (Vue/React or vanilla routing)
app.get(`${BASE_PATH}*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.use(errorHandler);

// ═══════════════════ DÉMARRAGE ═══════════════════

async function start() {
  await getDb(); // Initialize DB (better-sqlite3)
  const setupDone = isSetupCompleted();

  const httpServer = http.createServer(app);
  attachWebSocket(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info({
      url: `http://localhost:${PORT}${BASE_PATH}`,
      ws: `ws://localhost:${PORT}/ws`,
      auth: 'JWT + Rôles (admin/manager/caissier)',
      db: 'SQLite (better-sqlite3) + WAL',
      setup: setupDone ? 'completed' : 'pending',
    }, `${config.APP_NAME} v${config.APP_VERSION} — EN LIGNE`);

    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════════╗');
    console.log(`  ║  ☕ ${config.APP_NAME} v5.0 — Café & Restaurant POS     ║`);
    console.log('  ╠══════════════════════════════════════════════════════════╣');
    console.log(`  ║   URL : http://localhost:${PORT}${BASE_PATH}                      ║`);
    console.log(`  ║   WS  : ws://localhost:${PORT}/ws                         ║`);
    console.log('  ║   Statut: EN LIGNE (better-sqlite3 + WebSocket)         ║');
    console.log('  ╚══════════════════════════════════════════════════════════╝');
    console.log('');
  });
}

// Exporter l'app pour les tests
module.exports = { app, start };

if (require.main === module) {
  start().catch(err => {
    logger.fatal({ err }, 'Erreur fatale au démarrage');
    process.exit(1);
  });
}