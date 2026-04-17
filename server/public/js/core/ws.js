/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Client WebSocket (core/ws.js)
 *  Connexion persistante avec reconnexion automatique.
 *  Dispatch les événements vers le state store.
 * ═══════════════════════════════════════════════════════════════
 */

const WS_URL = `ws://${location.host}/ws`;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

let _ws = null;
let _reconnectDelay = RECONNECT_DELAY_MS;
let _reconnectTimer = null;
let _handlers = {};
let _connected = false;

/** Enregistre un handler pour un type d'événement WS */
function on(event, handler) {
  if (!_handlers[event]) _handlers[event] = [];
  _handlers[event].push(handler);
  return () => {
    _handlers[event] = (_handlers[event] || []).filter(h => h !== handler);
  };
}

/** Diffuse un événement localement (depuis le WS) */
function _dispatch(event, payload) {
  const handlers = _handlers[event] || [];
  for (const h of handlers) {
    try { h(payload); } catch (e) { console.error('[WS] handler error', e); }
  }
  // Broadcast global via CustomEvent pour les composants non connectés
  window.dispatchEvent(new CustomEvent(`ws:${event}`, { detail: payload }));
}

function _connect() {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

  try {
    _ws = new WebSocket(WS_URL);
  } catch (e) {
    console.warn('[WS] WebSocket non supporté ou serveur non disponible');
    return;
  }

  _ws.addEventListener('open', () => {
    console.info('[WS] Connecté');
    _connected = true;
    _reconnectDelay = RECONNECT_DELAY_MS;
    _dispatch('connected', null);
    // Mettre à jour indicateur UI
    document.getElementById('ws-indicator')?.classList.remove('offline');
    document.getElementById('ws-indicator')?.classList.add('online');
  });

  _ws.addEventListener('message', (evt) => {
    try {
      const { event, payload } = JSON.parse(evt.data);
      _dispatch(event, payload);
    } catch (e) {
      console.warn('[WS] message non parsable:', evt.data);
    }
  });

  _ws.addEventListener('close', () => {
    _connected = false;
    _dispatch('disconnected', null);
    document.getElementById('ws-indicator')?.classList.remove('online');
    document.getElementById('ws-indicator')?.classList.add('offline');
    // Reconnexion exponentielle
    _reconnectTimer = setTimeout(() => {
      _reconnectDelay = Math.min(_reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS);
      _connect();
    }, _reconnectDelay);
  });

  _ws.addEventListener('error', (err) => {
    console.warn('[WS] erreur:', err);
  });
}

function _disconnect() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_ws) { _ws.close(); _ws = null; }
  _connected = false;
}

function isConnected() { return _connected; }

// Auto-démarrage
_connect();

export const WS = { on, isConnected, connect: _connect, disconnect: _disconnect };
