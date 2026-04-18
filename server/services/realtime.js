/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Service Temps Réel (WebSocket)
 *  Broadcast d'événements métier vers tous les clients connectés.
 *
 *  Événements émis :
 *    table.updated      — statut ou position d'une table modifié
 *    commande.created   — nouvelle commande ouverte
 *    commande.envoyee_cuisine — commande envoyée en cuisine
 *    commande.encaissee — commande clôturée
 *    ligne.prete        — ligne marquée prête par la cuisine
 *    caisse.ouverte     — session caisse ouverte
 *    caisse.fermee      — session caisse fermée
 * ═══════════════════════════════════════════════════════════════
 */
const logger = require('../logger');

/** @type {Set<import('ws').WebSocket>} */
let _clients = new Set();

/**
 * Attache le serveur WebSocket à un serveur HTTP.
 * Doit être appelé une fois après `http.createServer(app)`.
 * @param {import('http').Server} httpServer
 */
function attachWebSocket(httpServer) {
  let WebSocketServer;
  try {
    WebSocketServer = require('ws').WebSocketServer;
  } catch {
    logger.warn('Module "ws" non installé — WebSocket désactivé. Lancez: npm install ws');
    return;
  }

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    _clients.add(ws);
    logger.info({ ip: req.socket.remoteAddress }, 'WebSocket client connecté');

    ws.on('close', () => {
      _clients.delete(ws);
    });

    ws.on('error', (err) => {
      logger.warn({ err: err.message }, 'WebSocket client error');
      _clients.delete(ws);
    });

    // Ping keepalive
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Heartbeat toutes les 30 s pour détecter les clients morts
  const heartbeat = setInterval(() => {
    for (const ws of _clients) {
      if (!ws.isAlive) {
        _clients.delete(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server actif sur /ws');
}

/**
 * Diffuse un événement JSON à tous les clients connectés.
 * @param {string} event  Nom de l'événement (ex: 'table.updated')
 * @param {object} payload  Données associées
 */
function broadcast(event, payload) {
  if (_clients.size === 0) return;
  const msg = JSON.stringify({ event, payload, ts: Date.now() });
  for (const ws of _clients) {
    try {
      if (ws.readyState === 1 /* OPEN */) ws.send(msg);
    } catch (err) {
      logger.warn({ err: err.message }, 'Échec broadcast WebSocket');
      _clients.delete(ws);
    }
  }
}

/** Nombre de clients WebSocket connectés */
function clientCount() {
  return _clients.size;
}

module.exports = { attachWebSocket, broadcast, clientCount };
