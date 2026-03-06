/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Configuration des tests
 *  Initialise la BD en mémoire et fournit des helpers
 * ═══════════════════════════════════════════════════════════════
 */
const request = require('supertest');
const path = require('path');

// Forcer la BD en mémoire pour les tests (chemin inexistant = BD vierge)
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, '..', 'test-pos-DO-NOT-USE.db');
process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.JWT_EXPIRES = '1h';
process.env.BASE_PATH = '/pos';
process.env.LOG_LEVEL = 'silent';

let app;
let adminToken;
let dbModule;
let serverModule;

/**
 * Initialise le serveur de test avec une BD vierge
 */
async function initTestApp() {
  if (app) return app;

  // Supprimer le fichier test DB s'il existe
  const fs = require('fs');
  const dbPath = process.env.DB_PATH;
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // Forcer le rechargement des modules (BD + serveur)
  delete require.cache[require.resolve('../db')];
  delete require.cache[require.resolve('../server')];
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../logger')];
  delete require.cache[require.resolve('../middleware')];
  delete require.cache[require.resolve('../validators')];

  dbModule = require('../db');
  await dbModule.getDb();

  serverModule = require('../server');
  app = serverModule.app;
  return app;
}

/**
 * Effectue le setup wizard et retourne le token admin
 */
async function setupAndLogin(testApp) {
  if (adminToken) return adminToken;

  // Compléter le setup wizard
  const setupRes = await request(testApp)
    .post('/pos/api/setup/complete')
    .send({
      profile_id: 'cafe',
      commerce: {
        nom: 'Test Café',
        adresse: '123 Rue Test, Casablanca',
        telephone: '0522000000',
        ice: '000000000000000',
      },
      admin: {
        login: 'admin_test',
        password: 'test1234',
        nom: 'Admin',
        prenom: 'Test',
      },
    });

  if (setupRes.status === 400 && setupRes.body.error === 'Le setup a déjà été effectué') {
    // Setup already done, just login
    const loginRes = await request(testApp)
      .post('/pos/api/auth/login')
      .send({ login: 'admin_test', password: 'test1234' });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    adminToken = loginRes.body.token;
    return adminToken;
  }

  if (setupRes.status !== 200) {
    throw new Error(`Setup failed (${setupRes.status}): ${JSON.stringify(setupRes.body)}`);
  }

  adminToken = setupRes.body.token;
  return adminToken;
}

/**
 * Retourne les headers d'authentification
 */
function authHeaders(token) {
  return { Authorization: `Bearer ${token || adminToken}` };
}

/**
 * Nettoyage après les tests
 */
function cleanupTestDb() {
  const fs = require('fs');
  const dbPath = process.env.DB_PATH;
  if (dbModule) {
    try { dbModule.resetDb(); } catch (_) {}
  }
  if (fs.existsSync(dbPath)) {
    try { fs.unlinkSync(dbPath); } catch (_) {}
  }
}

module.exports = {
  initTestApp,
  setupAndLogin,
  authHeaders,
  cleanupTestDb,
  getAdminToken: () => adminToken,
};
