/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Processus Principal Electron
 *  - Lance le serveur Node en sous-processus
 *  - Attend que l'app soit prête puis ouvre BrowserWindow
 *  - Gère plein écran, multi-écran KDS, et arrêt propre
 * ═══════════════════════════════════════════════════════════════
 */
const { app, BrowserWindow, screen, globalShortcut, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

// ─── Configuration ───────────────────────────────────────────────────────────
const SERVER_PORT = process.env.PORT || 3000;
const BASE_PATH = '/pos';
const SERVER_URL = `http://localhost:${SERVER_PORT}${BASE_PATH}`;
const IS_DEV = process.env.NODE_ENV === 'development';
const KIOSK_MODE = process.env.KIOSK !== '0' && process.env.KIOSK !== 'false' && process.env.KIOSK !== 'no'; // actif par défaut

// ─── Variables globales ───────────────────────────────────────────────────────
let mainWindow = null;
let kdsWindow = null;
let customerDisplayWindow = null;
let serverProcess = null;
let serverReady = false;

// ─── Lancer le serveur Node ───────────────────────────────────────────────────
function startServer() {
  const serverPath = IS_DEV
    ? path.join(__dirname, '..', 'server', 'server.js')
    : path.join(process.resourcesPath, 'server', 'server.js');

  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: String(SERVER_PORT), NODE_ENV: 'production' },
    silent: false,
  });

  serverProcess.on('error', (err) => {
    console.error('Erreur serveur:', err);
  });

  serverProcess.on('exit', (code) => {
    console.log('Serveur arrêté, code:', code);
  });
}

// ─── Attendre que le serveur réponde ─────────────────────────────────────────
function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(SERVER_URL, (res) => {
        if (res.statusCode < 500) { serverReady = true; resolve(); }
        else retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (retries-- <= 0) return reject(new Error('Serveur non disponible'));
      setTimeout(attempt, 1000);
    };
    attempt();
  });
}

// ─── Créer la fenêtre principale ─────────────────────────────────────────────
function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: !IS_DEV,
    kiosk: KIOSK_MODE && !IS_DEV,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: IS_DEV,
    },
    icon: path.join(__dirname, 'build', 'icon.png'),
    title: 'RITAJ Smart POS',
  });

  mainWindow.loadURL(SERVER_URL);

  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Créer la fenêtre KDS (Kitchen Display System) ───────────────────────────
function createKDSWindow() {
  const displays = screen.getAllDisplays();
  if (displays.length < 2) return; // Pas de 2e écran

  const secondDisplay = displays[1];
  const { x, y, width, height } = secondDisplay.workArea;

  kdsWindow = new BrowserWindow({
    x, y, width, height,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'KDS — Cuisine',
  });

  kdsWindow.loadURL(`${SERVER_URL}#/cuisine`);
  kdsWindow.on('closed', () => { kdsWindow = null; });
}

// ─── Créer la fenêtre Afficheur Client (Customer Display) ─────────────────────
/**
 * Ouvre l'afficheur client sur le 3e écran (ou 2e si pas de KDS).
 * Priorité d'écrans : principal=0, KDS=1, afficheur=2 (ou 1 si pas de KDS).
 */
function createCustomerDisplayWindow() {
  const displays = screen.getAllDisplays();
  // Choisir l'écran disponible (3e si dispo, sinon 2e, sinon on n'ouvre pas)
  const targetIndex = displays.length >= 3 ? 2 : (displays.length >= 2 ? 1 : -1);
  if (targetIndex < 0) return;

  // Éviter de superposer avec la fenêtre KDS
  if (kdsWindow && targetIndex === 1) return;

  const targetDisplay = displays[targetIndex];
  const { x, y, width, height } = targetDisplay.workArea;

  customerDisplayWindow = new BrowserWindow({
    x, y, width, height,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#0a0e1a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Pas de preload — page publique sans IPC
    },
    title: 'Afficheur Client',
  });

  customerDisplayWindow.loadURL(`${SERVER_URL.replace(/\/pos$/, '')}/pos/customer-display.html`);
  customerDisplayWindow.on('closed', () => { customerDisplayWindow = null; });
}

// ─── Verrouillage kiosque (optionnel) ─────────────────────────────────────────
function registerKioskShortcuts() {
  if (!KIOSK_MODE || IS_DEV) return;
  // Empêcher Alt+F4, F11, etc. en mode kiosque
  globalShortcut.registerAll(['Alt+F4', 'F11', 'CommandOrControl+W'], () => false);
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:exit', () => app.quit());
ipcMain.handle('app:fullscreen', () => {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
});
ipcMain.handle('app:open-kds', createKDSWindow);
ipcMain.handle('app:open-customer-display', createCustomerDisplayWindow);
ipcMain.handle('app:backup-path', () => {
  return IS_DEV
    ? path.join(__dirname, '..', 'server', 'backups')
    : path.join(process.resourcesPath, 'server', 'backups');
});

// ─── Cycle de vie Electron ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startServer();

  try {
    await waitForServer();
  } catch (err) {
    dialog.showErrorBox('Erreur démarrage', `Le serveur n'a pas démarré : ${err.message}`);
    app.quit();
    return;
  }

  createMainWindow();
  createKDSWindow();
  createCustomerDisplayWindow();
  registerKioskShortcuts();

  if (!IS_DEV) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

app.on('activate', () => {
  if (!mainWindow) createMainWindow();
});

// ─── Auto-update events ────────────────────────────────────────────────────────
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update:available', info);
  }
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Mise à jour disponible',
    message: 'Une mise à jour a été téléchargée. L\'application redémarrera après installation.',
    buttons: ['Installer maintenant', 'Plus tard'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});
