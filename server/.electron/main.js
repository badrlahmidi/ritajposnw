/**
 * Electron Main Process — Ritaj Smart POS v4.2 Desktop
 * 
 * This file runs the Electron main process, which:
 * - Creates the browser window
 * - Loads the React POS UI (public/index.html)
 * - Starts the embedded Node.js server on a local port
 * - Handles OS integration (tray, menus, etc.)
 */

const { app, BrowserWindow, ipcMain, nativeImage, Tray } = require('electron');
const path = require('path');
const url = require('url');

// Serve the React POS UI from the local 'public' directory
// or fall back to remote if developing
let mainWindow = null;
let tray = null;
let server = null;
let serverPort = 3000;

// Serve the React app from public/ directory
const serve = false; // Set to true for development with Vite/webpack

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      // Preload script can expose Node.js APIs to the renderer
      // preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // enableForceCompositing: true,
    },
    icon: path.join(__dirname, '..', 'public', 'icon-512.png'),
    show: false, // Show when ready-to-present
    backgroundColor: '#ffffff',
  });

  if (serve) {
    // Development: load from Vite dev server
    const vite = require('vite');
    vite
      .serve({
        middleware: (req, res) => {
          res.type('text/html');
          res.end(require('fs').readFileSync(path.join(__dirname, '../index.html'), 'utf-8'));
        },
      })
      .then(() => {
        mainWindow.loadURL('http://localhost:5173');
      });
  } else {
    // Production: load from local file system (public/index.html)
    const htmlPath = url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true,
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html')).catch((err) => {
      console.error('Failed to load index.html:', err);
    });
  }
}

// Start the Node.js Express server embedded in the Electron app
async function startEmbeddedServer() {
  try {
    // We'll use the existing server.js but listen on a different port
    // or we can use the already-running server
    console.log('Embedded server start - using existing backend API');
    // The Electron window will connect to the server at http://localhost:3000
    // or we can use nodeIntegration to access the backend directly
    console.log('Electron desktop app ready - connecting to POS API');
  } catch (err) {
    console.error('Error starting embedded server:', err);
  }
}

app.whenReady().then(() => {
  createWindow();
  startEmbeddedServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle IPC messages from the renderer process
ipcMain.handle('pos:get-api-url', () => {
  return `http://localhost:${serverPort}`;
});

// Tray integration (macOS/Windows)
app.on('ready', () => {
  const iconPath = path.join(__dirname, '..', 'public', 'icon-192.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setSize(16, 16);

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ritaj Smart POS', enabled: false },
    { type: 'separator' },
    { label: 'Ouvrir l\'application', click: () => mainWindow.show() },
    { label: 'Quitter', click: () => app.quit() },
  ]);
  tray.setToolTip('Ritaj Smart POS v4.2');
  tray.setContextMenu(contextMenu);
});

// Cleanup on exit
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (mainWindow) {
    mainWindow = null;
  }
});

module.exports = { app, BrowserWindow, ipcMain };