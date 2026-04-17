/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Preload Electron (IPC sécurisé)
 *  Expose une API minimale window.ritaj au renderer.
 *  contextIsolation: true + nodeIntegration: false
 * ═══════════════════════════════════════════════════════════════
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ritaj', {
  /** Version de l'application desktop */
  getVersion: () => ipcRenderer.invoke('app:version'),

  /** Quitter l'application */
  exit: () => ipcRenderer.invoke('app:exit'),

  /** Basculer plein écran */
  toggleFullscreen: () => ipcRenderer.invoke('app:fullscreen'),

  /** Ouvrir le KDS sur le 2e écran */
  openKDS: () => ipcRenderer.invoke('app:open-kds'),

  /** Chemin du dossier backups */
  getBackupPath: () => ipcRenderer.invoke('app:backup-path'),

  /** Écouter les événements de mise à jour */
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_event, info) => cb(info)),
});
