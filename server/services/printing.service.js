/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Service Impression ESC/POS
 *  Supporte : Epson TM-T20 / TM-T88, Xprinter XP-80, Star TSP143
 *  Connexion : Réseau TCP (IP:Port) ou USB (HID simulé via réseau)
 *
 *  Pas de dépendance native — encode ESC/POS en pur JS et envoie
 *  via TCP `net.createConnection` (supporte toutes les imprimantes
 *  réseau standard) ou via l'API `webContents.print` d'Electron
 *  comme fallback PDF silencieux.
 * ═══════════════════════════════════════════════════════════════
 */
const net = require('net');
const path = require('path');
const logger = require('../logger');
const { queryAll, queryOne } = require('../db');

// ─── Constantes ESC/POS ───────────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;
const CR  = 0x0d;

const CMD = {
  INIT:           Buffer.from([ESC, 0x40]),                     // Initialise l'imprimante
  ALIGN_LEFT:     Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER:   Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT:    Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:        Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:       Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT:  Buffer.from([ESC, 0x21, 0x10]),               // Double hauteur
  NORMAL_SIZE:    Buffer.from([ESC, 0x21, 0x00]),
  CUT:            Buffer.from([GS,  0x56, 0x41, 0x03]),         // Coupe partielle
  FULL_CUT:       Buffer.from([GS,  0x56, 0x00]),               // Coupe totale
  DRAWER_KICK:    Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]),   // Kick tiroir-caisse port 1
  DRAWER_KICK_2:  Buffer.from([ESC, 0x70, 0x01, 0x19, 0xfa]),   // Kick tiroir-caisse port 2
  FEED_3:         Buffer.from([ESC, 0x64, 0x03]),               // Avance 3 lignes
  FEED_5:         Buffer.from([ESC, 0x64, 0x05]),
  CHARSET_UTF8:   Buffer.from([ESC, 0x74, 0x10]),               // Code page Latin-1 (Windows-1252)
};

// ─── Encodage texte (Latin-1 pour ESC/POS standard) ─────────────────────────
function encodeText(text) {
  // Translittération des caractères accentués courants en français/arabe vers ASCII
  const map = {
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a',
    'î': 'i', 'ï': 'i', 'ì': 'i', 'í': 'i',
    'ô': 'o', 'ö': 'o', 'ò': 'o', 'ó': 'o',
    'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
    'ç': 'c', 'ñ': 'n',
    'É': 'E', 'È': 'E', 'Ê': 'E',
    'À': 'A', 'Â': 'A', 'Î': 'I',
    'Ô': 'O', 'Ù': 'U', 'Û': 'U', 'Ç': 'C',
  };
  return text.replace(/[^\x00-\x7F]/g, ch => map[ch] || '?');
}

// ─── Formatage lignes ticket ─────────────────────────────────────────────────

/** Largeur standard ticket 80mm = 48 caractères ; 58mm = 32 caractères */
const DEFAULT_WIDTH = 48;

function line(text, width = DEFAULT_WIDTH) {
  return Buffer.from(encodeText(text.substring(0, width)).padEnd(width, ' ') + '\n', 'latin1');
}

function separator(char = '-', width = DEFAULT_WIDTH) {
  return Buffer.from(char.repeat(width) + '\n', 'latin1');
}

function twoCol(left, right, width = DEFAULT_WIDTH) {
  const l = encodeText(String(left));
  const r = encodeText(String(right));
  const spaces = Math.max(1, width - l.length - r.length);
  return Buffer.from(l + ' '.repeat(spaces) + r + '\n', 'latin1');
}

function centerLine(text, width = DEFAULT_WIDTH) {
  const t = encodeText(text);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return Buffer.from(' '.repeat(pad) + t + '\n', 'latin1');
}

// ─── Construction du ticket de caisse ────────────────────────────────────────

/**
 * Construit le buffer ESC/POS pour un ticket de caisse.
 * @param {object} commande  Commande complète (avec lignes, client, etc.)
 * @param {object} config    Paramètres du commerce (nom, ice, adresse…)
 * @param {object} opts      { openDrawer: bool, cutPaper: bool, width: number }
 * @returns {Buffer}
 */
function buildTicketBuffer(commande, config = {}, opts = {}) {
  const { openDrawer = false, cutPaper = true, width = DEFAULT_WIDTH } = opts;

  const parts = [
    CMD.INIT,
    CMD.CHARSET_UTF8,
    CMD.ALIGN_CENTER,
  ];

  // ── En-tête ──────────────────────────────────────────────────────────────
  if (config.logo_text) {
    parts.push(CMD.DOUBLE_HEIGHT);
    parts.push(centerLine(config.logo_text, width));
    parts.push(CMD.NORMAL_SIZE);
  }
  if (config.nom) {
    parts.push(CMD.BOLD_ON);
    parts.push(centerLine(config.nom, width));
    parts.push(CMD.BOLD_OFF);
  }
  if (config.adresse)   parts.push(centerLine(config.adresse, width));
  if (config.telephone) parts.push(centerLine(`Tel: ${config.telephone}`, width));
  if (config.ice)       parts.push(centerLine(`ICE: ${config.ice}`, width));
  if (config.if_fiscal) parts.push(centerLine(`IF: ${config.if_fiscal}`, width));

  parts.push(separator('=', width));

  // ── Info commande ─────────────────────────────────────────────────────────
  parts.push(CMD.ALIGN_LEFT);
  parts.push(twoCol(`N° ${commande.numero}`, new Date().toLocaleString('fr-MA'), width));
  if (commande.table_numero) {
    parts.push(twoCol('Table:', commande.table_numero, width));
  }
  if (commande.serveur_nom) {
    parts.push(twoCol('Serveur:', commande.serveur_nom, width));
  }
  if (commande.nb_couverts) {
    parts.push(twoCol('Couverts:', String(commande.nb_couverts), width));
  }
  parts.push(separator('-', width));

  // ── Lignes produits ───────────────────────────────────────────────────────
  const lignes = commande.lignes || [];
  for (const l of lignes) {
    const qtyNom = `${l.quantite} x ${l.produit_nom || l.nom || '?'}`;
    const prix = `${Number(l.total_ligne || l.prix_unitaire * l.quantite).toFixed(2)} DH`;
    parts.push(twoCol(qtyNom, prix, width));
    if (l.notes_cuisine) {
      parts.push(line(`  -> ${l.notes_cuisine}`, width));
    }
  }
  parts.push(separator('-', width));

  // ── Totaux ────────────────────────────────────────────────────────────────
  if (commande.remise_montant > 0) {
    parts.push(twoCol('Sous-total:', `${Number(commande.sous_total || 0).toFixed(2)} DH`, width));
    parts.push(twoCol('Remise:', `-${Number(commande.remise_montant).toFixed(2)} DH`, width));
  }
  if (commande.total_tva) {
    parts.push(twoCol('TVA:', `${Number(commande.total_tva).toFixed(2)} DH`, width));
  }
  parts.push(CMD.BOLD_ON);
  parts.push(twoCol('TOTAL TTC:', `${Number(commande.total || commande.total_ttc || 0).toFixed(2)} DH`, width));
  parts.push(CMD.BOLD_OFF);

  // Paiement(s)
  const paiements = commande.paiements || [];
  for (const p of paiements) {
    parts.push(twoCol(`Paiement (${p.mode || 'especes'}):`, `${Number(p.montant).toFixed(2)} DH`, width));
  }
  if (commande.monnaie_rendue > 0) {
    parts.push(twoCol('Monnaie rendue:', `${Number(commande.monnaie_rendue).toFixed(2)} DH`, width));
  }

  // ── Pied de page ─────────────────────────────────────────────────────────
  parts.push(separator('=', width));
  parts.push(CMD.ALIGN_CENTER);
  const footer = config.ticket_footer || 'Merci de votre visite !';
  parts.push(centerLine(footer, width));

  if (config.wifi_ssid) {
    parts.push(centerLine(`WiFi: ${config.wifi_ssid}`, width));
  }

  parts.push(CMD.FEED_5);

  // ── Coupe / Tiroir ────────────────────────────────────────────────────────
  if (openDrawer) parts.push(CMD.DRAWER_KICK);
  if (cutPaper)   parts.push(CMD.CUT);

  return Buffer.concat(parts);
}

// ─── Construction du ticket cuisine / bar ────────────────────────────────────

/**
 * Construit le buffer ESC/POS pour un ticket de cuisine/bar.
 * @param {object} commande
 * @param {object} opts  { cours: 'entree'|'plat'|'dessert'|'boisson'|null, width }
 * @returns {Buffer}
 */
function buildKitchenBuffer(commande, opts = {}) {
  const { cours = null, width = DEFAULT_WIDTH } = opts;
  const parts = [CMD.INIT, CMD.CHARSET_UTF8];

  // ── En-tête ──────────────────────────────────────────────────────────────
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.DOUBLE_HEIGHT);
  const labelCours = cours
    ? cours.toUpperCase()
    : 'CUISINE';
  parts.push(centerLine(`*** ${labelCours} ***`, width));
  parts.push(CMD.NORMAL_SIZE);

  parts.push(CMD.ALIGN_LEFT);
  const tableStr = commande.table_numero ? `Table ${commande.table_numero}` : 'À emporter';
  parts.push(twoCol(tableStr, new Date().toLocaleTimeString('fr-MA'), width));
  parts.push(twoCol(`Cmd: ${commande.numero}`, `${commande.nb_couverts || 1} couvert(s)`, width));
  parts.push(separator('=', width));

  // ── Lignes filtrées par cours ─────────────────────────────────────────────
  let lignes = commande.lignes || [];
  if (cours) {
    lignes = lignes.filter(l => l.cours === cours);
  }

  for (const l of lignes) {
    parts.push(CMD.BOLD_ON);
    parts.push(line(`${l.quantite} x ${l.produit_nom || l.nom || '?'}`, width));
    parts.push(CMD.BOLD_OFF);
    if (l.notes_cuisine) {
      parts.push(line(`  !! ${l.notes_cuisine}`, width));
    }
    if (l.options_json) {
      try {
        const opts_list = JSON.parse(l.options_json);
        if (Array.isArray(opts_list)) {
          for (const o of opts_list) {
            parts.push(line(`  + ${o}`, width));
          }
        }
      } catch { /* ignore */ }
    }
  }

  parts.push(CMD.FEED_5);
  parts.push(CMD.CUT);

  return Buffer.concat(parts);
}

// ─── Envoi TCP vers imprimante réseau ────────────────────────────────────────

/**
 * Envoie un buffer ESC/POS vers une imprimante réseau TCP.
 * @param {string} ip
 * @param {number} port
 * @param {Buffer} data
 * @param {number} [timeout=5000]
 * @returns {Promise<void>}
 */
function sendTCP(ip, port, data, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port, timeout }, () => {
      socket.write(data, (err) => {
        if (err) {
          socket.destroy();
          return reject(err);
        }
        // Petit délai avant de fermer pour que l'imprimante traite tout
        setTimeout(() => { socket.end(); resolve(); }, 200);
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout connexion imprimante ${ip}:${port}`));
    });

    socket.on('error', (err) => {
      reject(new Error(`Erreur imprimante ${ip}:${port} — ${err.message}`));
    });
  });
}

// ─── Récupération de la config commerce ──────────────────────────────────────

function getCommerceConfig() {
  try {
    const rows = queryAll("SELECT cle, valeur FROM parametres WHERE cle IN ('nom_commerce','adresse','telephone','ice','if_fiscal','ticket_footer','wifi_ssid','logo_text')");
    return Object.fromEntries(rows.map(r => [r.cle, r.valeur]));
  } catch {
    return {};
  }
}

// ─── API publique du service ──────────────────────────────────────────────────

/**
 * Imprime un ticket de caisse sur l'imprimante de type 'ticket'.
 * @param {object} commande  Commande + lignes
 * @param {object} opts  { openDrawer, cutPaper }
 * @returns {Promise<{ success, message, printer? }>}
 */
async function printTicket(commande, opts = {}) {
  const config = getCommerceConfig();
  const buffer = buildTicketBuffer(commande, config, opts);
  return _printToType('ticket', buffer, commande.id);
}

/**
 * Imprime un ticket de cuisine/bar sur les imprimantes configurées.
 * @param {object} commande
 * @param {string|null} cours  Filtrer par cours (null = tout)
 * @returns {Promise<{ success, results }>}
 */
async function printKitchen(commande, cours = null) {
  // Chercher toutes les imprimantes actives de type cuisine ou bar
  let imprimantes = [];
  try {
    imprimantes = queryAll("SELECT * FROM imprimantes WHERE actif=1 AND type IN ('cuisine','bar')");
  } catch {
    return { success: false, message: 'Table imprimantes non disponible' };
  }

  if (!imprimantes.length) {
    return { success: false, message: 'Aucune imprimante cuisine/bar configurée' };
  }

  const results = [];
  for (const imp of imprimantes) {
    // Filtrer par catégorie si configuré
    let shouldPrint = true;
    if (imp.categories_json && commande.lignes) {
      try {
        const cats = JSON.parse(imp.categories_json);
        shouldPrint = commande.lignes.some(l => cats.includes(l.categorie_id));
      } catch { /* imprimer quand même */ }
    }
    if (!shouldPrint) continue;

    const typeCours = imp.type === 'bar' ? 'boisson' : cours;
    const buffer = buildKitchenBuffer(commande, { cours: typeCours });
    try {
      await sendTCP(imp.ip, imp.port || 9100, buffer);
      results.push({ printer: imp.nom, success: true });
      logger.info({ printer: imp.nom, commande_id: commande.id }, 'Ticket cuisine imprimé');
    } catch (err) {
      results.push({ printer: imp.nom, success: false, error: err.message });
      logger.warn({ printer: imp.nom, err: err.message }, 'Échec impression cuisine');
    }
  }

  return { success: results.some(r => r.success), results };
}

/**
 * Ouvre le tiroir-caisse via l'imprimante de type 'ticket'.
 * @returns {Promise<{ success, message }>}
 */
async function openDrawer() {
  return _printToType('ticket', CMD.DRAWER_KICK, null, 'Ouverture tiroir-caisse');
}

/**
 * Impression de test — imprime une page de test sur l'imprimante.
 * @param {string} ip
 * @param {number} port
 * @returns {Promise<{ success, message }>}
 */
async function testPrint(ip, port = 9100) {
  const config = getCommerceConfig();
  const parts = [
    CMD.INIT, CMD.ALIGN_CENTER,
    CMD.BOLD_ON, centerLine('*** TEST IMPRESSION ***'), CMD.BOLD_OFF,
    centerLine(config.nom || 'RITAJ SMART POS'),
    separator(),
    centerLine(`IP: ${ip}:${port}`),
    centerLine(new Date().toLocaleString('fr-MA')),
    separator(),
    centerLine('ESC/POS OK'),
    CMD.FEED_5, CMD.CUT,
  ];
  const buffer = Buffer.concat(parts);
  try {
    await sendTCP(ip, port, buffer);
    return { success: true, message: `Test imprimé sur ${ip}:${port}` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ─── Interne ─────────────────────────────────────────────────────────────────

async function _printToType(type, buffer, commandeId = null, label = '') {
  let imprimante = null;
  try {
    imprimante = queryOne("SELECT * FROM imprimantes WHERE type=? AND actif=1 LIMIT 1", [type]);
  } catch {
    /* table pas encore créée en test */
  }

  if (!imprimante) {
    logger.warn({ type, commandeId }, `Aucune imprimante ${type} active configurée`);
    return { success: false, message: `Aucune imprimante '${type}' configurée` };
  }

  try {
    await sendTCP(imprimante.ip, imprimante.port || 9100, buffer);
    logger.info({ printer: imprimante.nom, commandeId, label }, `Impression ${type} réussie`);
    return { success: true, printer: imprimante.nom };
  } catch (err) {
    logger.error({ printer: imprimante.nom, err: err.message }, `Échec impression ${type}`);
    return { success: false, message: err.message, printer: imprimante.nom };
  }
}

module.exports = {
  buildTicketBuffer,
  buildKitchenBuffer,
  sendTCP,
  printTicket,
  printKitchen,
  openDrawer,
  testPrint,
};
