/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Configuration centralisée
 *  Toutes les variables d'environnement et constantes du serveur
 * ═══════════════════════════════════════════════════════════════
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

// Marqueurs identifiants une clé JWT "par défaut" inacceptable en production.
const WEAK_SECRET_MARKERS = ['default', 'change', 'example', 'placeholder', 'sample', 'CHANGE-ME'];

function isWeakSecret(secret) {
  if (!secret || typeof secret !== 'string') return true;
  if (secret.length < 32) return true;
  const low = secret.toLowerCase();
  return WEAK_SECRET_MARKERS.some(m => low.includes(m.toLowerCase()));
}

function generateSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Persiste un JWT_SECRET fraîchement généré dans server/.env (permissions 0600),
 * en créant le fichier ou en ajoutant/actualisant uniquement la ligne JWT_SECRET.
 * N'est appelé qu'en dehors de la production.
 */
function persistGeneratedSecret(secret) {
  try {
    const envPath = path.join(__dirname, '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      if (/^JWT_SECRET=.*$/m.test(content)) {
        content = content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
      } else {
        content += (content.endsWith('\n') || content.length === 0 ? '' : '\n') + `JWT_SECRET=${secret}\n`;
      }
    } else {
      content = `# Auto-généré au premier démarrage — NE PAS COMMITER\nJWT_SECRET=${secret}\n`;
    }
    fs.writeFileSync(envPath, content, { mode: 0o600 });
    try { fs.chmodSync(envPath, 0o600); } catch (_) { /* Windows */ }
    process.env.JWT_SECRET = secret;
    return true;
  } catch (err) {
    console.warn('  ⚠️  Impossible de persister JWT_SECRET dans .env :', err.message);
    return false;
  }
}

let jwtSecret = process.env.JWT_SECRET;

if (isWeakSecret(jwtSecret)) {
  if (IS_PROD) {
    // Production : refuser de démarrer. La sécurité du JWT est non négociable.
    console.error('');
    console.error('  ❌ ERREUR FATALE : JWT_SECRET manquant, trop court ou insuffisamment sûr.');
    console.error('     - Minimum 32 caractères');
    console.error('     - Ne doit pas contenir: ' + WEAK_SECRET_MARKERS.join(', '));
    console.error('     Générez-en une via :');
    console.error('       node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    console.error('     puis placez la valeur dans la variable d\'environnement JWT_SECRET.');
    console.error('');
    process.exit(1);
  } else if (IS_TEST) {
    // Tests : l'appelant (tests/setup.js) fournit une valeur figée.
    // Si c'est absent, on génère une clé en mémoire uniquement (pas de .env).
    jwtSecret = jwtSecret && jwtSecret.length >= 16 ? jwtSecret : generateSecret();
  } else {
    // Développement : générer une clé forte et la persister dans .env (0600).
    const generated = generateSecret();
    const persisted = persistGeneratedSecret(generated);
    jwtSecret = generated;
    if (persisted) {
      console.warn('  🔐  JWT_SECRET auto-généré et enregistré dans server/.env (permissions 0600).');
      console.warn('      Conservez cette clé : changez-la invalidera toutes les sessions existantes.');
    } else {
      console.warn('  🔐  JWT_SECRET auto-généré (en mémoire uniquement).');
    }
  }
}

const config = {
  // Environnement
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD,
  IS_TEST,

  // Serveur
  PORT: parseInt(process.env.PORT, 10) || 3000,
  BASE_PATH: process.env.BASE_PATH || '/pos',

  // JWT
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES: process.env.JWT_EXPIRES || '12h',

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [],

  // App
  APP_NAME: process.env.APP_NAME || 'RITAJ SMART POS',
  // Source unique de vérité: package.json.
  APP_VERSION: process.env.APP_VERSION || require('./package.json').version,
};

// Exporter aussi les helpers pour les tests.
module.exports = config;
module.exports.isWeakSecret = isWeakSecret;
module.exports.generateSecret = generateSecret;
