/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Planificateur de tâches périodiques
 *  Actuellement : backup automatique toutes les 4 heures.
 *
 *  Extrait de db.js pour permettre aux tests (Jest) de se terminer
 *  proprement sans handle ouvert — start() n'est appelé que depuis
 *  server.js::start(), pas depuis db.getDb().
 * ═══════════════════════════════════════════════════════════════
 */
const { createBackup } = require('./db');

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

let backupTimer = null;

function startScheduler(options = {}) {
  const { backupIntervalMs = FOUR_HOURS_MS } = options;
  if (backupTimer) return; // déjà démarré — idempotent

  backupTimer = setInterval(() => {
    try {
      createBackup();
    } catch (e) {
      // Loggé par createBackup lui-même ; on ne fait pas crasher le process.
    }
  }, backupIntervalMs);

  // Ne pas empêcher Node.js de sortir si c'est la seule tâche en attente
  // (utile pour les tests d'intégration, les CLI et le graceful shutdown).
  if (typeof backupTimer.unref === 'function') backupTimer.unref();
}

function stopScheduler() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

module.exports = { startScheduler, stopScheduler };
