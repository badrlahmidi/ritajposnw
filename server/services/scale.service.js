/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Service Balance Série (optionnel)
 *  Protocoles supportés :
 *   - Balances CAS (protocole ASCII simple : poids en grammes)
 *   - Balances Mettler-Toledo (protocole MT-SICS)
 *   - Balances Ohaus (protocole RS-232 standard)
 *   - Generic : parser ligne contenant un nombre décimal (kg ou g)
 *
 *  Dépendance : `serialport` (npm install serialport)
 *  Si serialport n'est pas installé, le service fonctionne en
 *  mode simulation (utile pour tests et environnements sans port série).
 *
 *  Configuration :
 *    balance_port     : ex '/dev/ttyUSB0' ou 'COM3'
 *    balance_baudrate : ex '9600'
 *    balance_protocol : 'cas' | 'mt-sics' | 'ohaus' | 'generic'
 *    balance_unit     : 'g' | 'kg'
 * ═══════════════════════════════════════════════════════════════
 */
const { EventEmitter } = require('events');
const logger = require('../logger');

// ─── État interne ─────────────────────────────────────────────────────────────
let _port = null;          // Instance SerialPort
let _lastWeight = null;    // Dernier poids lu (kg)
let _stable = false;       // Poids stable (balance prête)
let _config = {};          // Config active
let _emitter = new EventEmitter();
let _simulationMode = false;

// ─── Parseurs par protocole ───────────────────────────────────────────────────

/**
 * Protocole CAS : ligne comme "   1.250 kg S\r\n"
 * ou "  1250 g S"
 */
function parseCAS(line) {
  const m = line.match(/([\d]+\.?[\d]*)\s*(kg|g)\s*(S)?/i);
  if (!m) return null;
  let val = parseFloat(m[1]);
  if (m[2].toLowerCase() === 'g') val /= 1000;
  return { kg: val, stable: !!m[3] };
}

/**
 * Protocole MT-SICS : "S S      1.250 kg\r\n" ou "S D      1.250 kg"
 * S = stable, D = dynamique/instable
 */
function parseMTSICS(line) {
  const m = line.match(/^S\s+(S|D)\s+([\d]+\.?[\d]*)\s*(kg|g)/i);
  if (!m) return null;
  let val = parseFloat(m[2]);
  if (m[3].toLowerCase() === 'g') val /= 1000;
  return { kg: val, stable: m[1] === 'S' };
}

/**
 * Protocole Ohaus : "  1.250 lb\r\n" ou "+001.250 kg"
 */
function parseOhaus(line) {
  const m = line.match(/[+\-]?([\d]+\.?[\d]*)\s*(lb|kg|g)/i);
  if (!m) return null;
  let val = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'g')  val /= 1000;
  if (unit === 'lb') val *= 0.453592;
  return { kg: val, stable: true }; // Ohaus envoie quand stable
}

/**
 * Protocole générique : cherche un nombre décimal dans la ligne
 */
function parseGeneric(line, unit = 'kg') {
  const m = line.match(/([\d]+\.?[\d]*)/);
  if (!m) return null;
  let val = parseFloat(m[1]);
  if (unit === 'g') val /= 1000;
  return { kg: val, stable: true };
}

function parseLine(line, protocol = 'generic', unit = 'kg') {
  const clean = line.trim();
  switch (protocol) {
    case 'cas':     return parseCAS(clean);
    case 'mt-sics': return parseMTSICS(clean);
    case 'ohaus':   return parseOhaus(clean);
    default:        return parseGeneric(clean, unit);
  }
}

// ─── Connexion série ─────────────────────────────────────────────────────────

/**
 * Initialise la connexion à la balance.
 * @param {object} cfg { port, baudrate, protocol, unit }
 * @returns {Promise<boolean>}  true si connexion réussie
 */
async function connect(cfg = {}) {
  _config = { ...cfg };
  const portPath  = cfg.port      || '/dev/ttyUSB0';
  const baudRate  = Number(cfg.baudrate || 9600);
  const protocol  = cfg.protocol  || 'generic';
  const unit      = cfg.unit      || 'kg';

  // Vérifier si serialport est disponible
  let SerialPort, ReadlineParser;
  try {
    const sp = require('serialport');
    SerialPort = sp.SerialPort;
    ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
  } catch {
    logger.warn('Module serialport non installé — balance en mode simulation');
    _simulationMode = true;
    return false;
  }

  if (_port && _port.isOpen) {
    await disconnect();
  }

  try {
    _port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
    const parser = _port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (line) => {
      const result = parseLine(line, protocol, unit);
      if (result !== null) {
        _lastWeight = result.kg;
        _stable = result.stable;
        _emitter.emit('weight', { kg: result.kg, stable: result.stable });
      }
    });

    _port.on('error', (err) => {
      logger.error({ err: err.message }, 'Erreur balance série');
      _emitter.emit('error', err);
    });

    _port.on('close', () => {
      logger.info('Balance série déconnectée');
      _emitter.emit('disconnected');
    });

    await new Promise((resolve, reject) => {
      _port.open((err) => err ? reject(err) : resolve());
    });

    logger.info({ port: portPath, baudRate, protocol }, 'Balance série connectée');
    return true;
  } catch (err) {
    logger.error({ err: err.message, portPath }, 'Impossible de connecter la balance');
    _port = null;
    return false;
  }
}

/**
 * Déconnecte la balance.
 */
function disconnect() {
  return new Promise((resolve) => {
    if (!_port) return resolve();
    _port.close(() => {
      _port = null;
      resolve();
    });
  });
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Lit le poids actuel (valeur mise en cache depuis le flux série).
 * @returns {{ kg: number|null, stable: boolean, mode: string }}
 */
function getCurrentWeight() {
  if (_simulationMode) {
    // En simulation : retourner un poids aléatoire stable
    return {
      kg: Number((Math.random() * 2 + 0.1).toFixed(3)),
      stable: true,
      mode: 'simulation',
    };
  }
  return {
    kg: _lastWeight,
    stable: _stable,
    mode: _port?.isOpen ? 'serial' : 'disconnected',
  };
}

/**
 * Demande une lecture active (pour protocoles pull : MT-SICS "S\r\n").
 * @returns {Promise<{ kg, stable, mode }>}
 */
function requestWeight() {
  return new Promise((resolve) => {
    if (_simulationMode) {
      return resolve(getCurrentWeight());
    }

    if (!_port || !_port.isOpen) {
      return resolve({ kg: null, stable: false, mode: 'disconnected' });
    }

    // Protocole MT-SICS : commande "S" pour demander le poids stable
    const protocol = _config.protocol || 'generic';
    if (protocol === 'mt-sics') {
      _port.write('S\r\n');
    }

    // Attendre la prochaine valeur stable (max 3s)
    const timeout = setTimeout(() => {
      _emitter.removeListener('weight', onWeight);
      resolve({ kg: _lastWeight, stable: _stable, mode: 'timeout' });
    }, 3000);

    const onWeight = ({ kg, stable }) => {
      if (stable) {
        clearTimeout(timeout);
        _emitter.removeListener('weight', onWeight);
        resolve({ kg, stable, mode: 'serial' });
      }
    };
    _emitter.on('weight', onWeight);
  });
}

/**
 * Vérifie si la balance est connectée et répond.
 * @returns {{ connected: boolean, port: string, simulation: boolean }}
 */
function getStatus() {
  return {
    connected: _simulationMode || (_port?.isOpen === true),
    simulation: _simulationMode,
    port: _config.port || null,
    protocol: _config.protocol || 'generic',
    last_weight_kg: _lastWeight,
    stable: _stable,
  };
}

/**
 * Liste les ports série disponibles (pour la configuration).
 * @returns {Promise<Array<{ path, manufacturer }>>}
 */
async function listPorts() {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || 'Unknown' }));
  } catch {
    return [];
  }
}

/** S'abonner aux événements poids */
function onWeight(handler) {
  _emitter.on('weight', handler);
  return () => _emitter.removeListener('weight', handler);
}

module.exports = {
  connect,
  disconnect,
  getCurrentWeight,
  requestWeight,
  getStatus,
  listPorts,
  onWeight,
  // Parseurs exportés pour tests
  parseCAS,
  parseMTSICS,
  parseOhaus,
  parseGeneric,
};
