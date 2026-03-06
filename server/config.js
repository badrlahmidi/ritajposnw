/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Configuration centralisée
 *  Toutes les variables d'environnement et constantes du serveur
 * ═══════════════════════════════════════════════════════════════
 */
require('dotenv').config();

const config = {
  // Serveur
  PORT: parseInt(process.env.PORT, 10) || 3000,
  BASE_PATH: process.env.BASE_PATH || '/pos',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'ritaj-smart-pos-default-secret-CHANGE-ME',
  JWT_EXPIRES: process.env.JWT_EXPIRES || '12h',

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [],

  // App
  APP_NAME: process.env.APP_NAME || 'RITAJ SMART POS',
  APP_VERSION: process.env.APP_VERSION || '4.1.0',
};

// Avertissement si le secret par défaut est utilisé en production
if (config.JWT_SECRET.includes('CHANGE') || config.JWT_SECRET.includes('default')) {
  console.warn('  ⚠️  ATTENTION: JWT_SECRET utilise une valeur par défaut. Changez-la en production via .env');
}

module.exports = config;
