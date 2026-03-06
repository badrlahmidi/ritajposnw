/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Module Base de Données v4.2 (2026)
 *  Backend: better-sqlite3 (Native, WAL Mode)
 *  Persistence: Disque (Fiable et Performant)
 * ═══════════════════════════════════════════════════════════════
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getProfile } = require('./business-profiles');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pos.db');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Instance globale
let db = null;
let recoveryMode = false;

// Helpers compatibles avec l'ancienne API (pour éviter de refactor tout le serveur)
// sql.js utilisait db.exec() qui retournait [{values: [[...]]}]
// better-sqlite3 utilise .prepare().all() ou .run()

/**
 * Initialise la connexion à la base de données
 */
async function getDb() {
  if (db) return db;

  const dbExists = fs.existsSync(DB_PATH);

  try {
    // Options: verbose log query in dev? maybe too noisy.
    db = new Database(DB_PATH); // Native synchronous connection
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for performance and robustness
    db.pragma('foreign_keys = ON');

    // Vérifier intégrité sommaire (si table parametres existe ou non)
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='parametres'").get();

    if (!tableCheck) {
      // Nouvelle base ou corrompue/vide
      // Vérifier backups pour recovery mode
      const backups = listBackups();
      const hasBackups = (backups.auto.length + backups.manual.length + backups.archives.length) > 0;

      if (hasBackups && !dbExists) {
        console.warn("⚠️ DB vide mais backups détectés -> Recovery Mode");
        recoveryMode = true;
      }

      createTables();

      if (!recoveryMode) {
        await seedInitialData();
      }
    }

    // Backup automatique régulier (toutes les 4 heures)
    // Utilise l'API backup native de SQLite
    setInterval(() => createBackup(), 4 * 60 * 60 * 1000);

    return db;

  } catch (err) {
    console.error("❌ Fatal DB Error:", err);
    recoveryMode = true;
    // En cas d'erreur fatale (fichier corrompu qui empêche l'ouverture),
    // better-sqlite3 throw direct.
    // On pourrait essayer de renommer le fichier corrompu et en créer un nouveau vide?
    if (err.code === 'SQLITE_CORRUPT' || err.code === 'SQLITE_NOTADB') {
      try {
        const corruptedPath = DB_PATH + '.corrupted.' + Date.now();
        fs.renameSync(DB_PATH, corruptedPath);
        console.error(`Moved corrupted DB to ${corruptedPath}`);
        return getDb(); // Retry with fresh check
      } catch (e) {
        throw e;
      }
    }
    throw err;
  }
}

function resetDb() {
  if (db) {
    try { db.close(); } catch (e) { }
    db = null;
  }
}

// ═══════════════════ WRAPPERS (COMPATIBILITÉ) ═══════════════════

function queryAll(sql, params = []) {
  if (!db) throw new Error("DB not initialized");
  try {
    return db.prepare(sql).all(params);
  } catch (e) {
    console.error("Query All Error:", sql, e.message);
    return [];
  }
}

function queryOne(sql, params = []) {
  if (!db) throw new Error("DB not initialized");
  try {
    return db.prepare(sql).get(params);
  } catch (e) {
    console.error("Query One Error:", sql, e.message);
    return null;
  }
}

function run(sql, params = []) {
  if (!db) throw new Error("DB not initialized");
  try {
    const info = db.prepare(sql).run(params);
    return {
      lastInsertRowid: info.lastInsertRowid,
      changes: info.changes
    };
  } catch (e) {
    console.error("Run Error:", sql, e.message);
    throw e;
  }
}

const transaction = (fn) => {
  if (!db) throw new Error("DB not initialized");
  return db.transaction(fn)();
};

function runTransaction(queries) {
  if (!db) throw new Error("DB not initialized");

  // Use the new flexible wrapper
  return transaction(() => {
    const results = [];
    for (const q of queries) {
      if (typeof q === 'function') {
        results.push(q());
      } else {
        const info = db.prepare(q.sql).run(q.params || []);
        results.push({ lastInsertRowid: info.lastInsertRowid, changes: info.changes });
      }
    }
    return results;
  });
}

function saveDb() {
  // No-op : WAL mode handles persistence automatically.
  // Kept for backward compat with server.js calls.
}

// ═══════════════════ BACKUP ═══════════════════

function createBackup(type = 'auto') {
  if (!db) return null;
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `pos_backup_${type}_${ts}.db`);

  try {
    // Native Backup API
    db.backup(backupPath)
      .then(() => {
        // Generate Checksum
        const crypto = require('crypto');
        const data = fs.readFileSync(backupPath); // Read back to hash
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        fs.writeFileSync(backupPath + '.sha256', `${hash}  ${path.basename(backupPath)}\n`, 'utf-8');

        // Rotate auto backups
        if (type === 'auto') rotateBackups();
      })
      .catch(err => console.error("Backup failed:", err));

    return backupPath;
  } catch (e) {
    console.error("Backup init failed", e);
    return null;
  }
}

function rotateBackups() {
  const autoFiles = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('pos_backup_auto_') && f.endsWith('.db'))
    .sort();
  while (autoFiles.length > 90) {
    const old = autoFiles.shift();
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      if (fs.existsSync(path.join(BACKUP_DIR, old + '.sha256'))) {
        fs.unlinkSync(path.join(BACKUP_DIR, old + '.sha256'));
      }
    } catch (e) { }
  }
}

function createArchiveBackup() {
  if (!db) return null;
  const archiveDir = path.join(BACKUP_DIR, 'archives');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const archivePath = path.join(archiveDir, `ritaj_archive_${year}-${month}.db`);

  db.backup(archivePath)
    .then(() => {
      const crypto = require('crypto');
      const data = fs.readFileSync(archivePath);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      fs.writeFileSync(archivePath + '.sha256', `${hash}  ${path.basename(archivePath)}\n`, 'utf-8');
    })
    .catch(err => console.error("Archive failed:", err));

  return archivePath;
}

function listBackups() {
  // Same implementation as before, FS based
  const result = { auto: [], manual: [], archives: [] };
  if (!fs.existsSync(BACKUP_DIR)) return result;

  // ... [Reuse existing logic, just reading files]
  // Copy-pasted for robustness
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort().reverse();
  for (const f of files) {
    const fullPath = path.join(BACKUP_DIR, f);
    const stat = fs.statSync(fullPath);
    const entry = {
      filename: f, size: stat.size, date: stat.mtime.toISOString(),
      hasChecksum: fs.existsSync(fullPath + '.sha256')
    };
    if (f.includes('_auto_')) result.auto.push(entry);
    else if (f.includes('_manual_')) result.manual.push(entry);
    else result.manual.push(entry);
  }
  const archiveDir = path.join(BACKUP_DIR, 'archives');
  if (fs.existsSync(archiveDir)) {
    const archFiles = fs.readdirSync(archiveDir).filter(f => f.endsWith('.db')).sort().reverse();
    for (const f of archFiles) {
      const fullPath = path.join(archiveDir, f);
      const stat = fs.statSync(fullPath);
      result.archives.push({
        filename: f, size: stat.size, date: stat.mtime.toISOString(),
        hasChecksum: fs.existsSync(fullPath + '.sha256')
      });
    }
  }
  return result;
}

function verifyBackupIntegrity(backupPath) {
  const crypto = require('crypto');
  const checksumPath = backupPath + '.sha256';
  if (!fs.existsSync(backupPath) || !fs.existsSync(checksumPath)) return { valid: false, error: 'Fichiers manquants' };

  const data = fs.readFileSync(backupPath);
  const actualHash = crypto.createHash('sha256').update(data).digest('hex');
  const storedHash = fs.readFileSync(checksumPath, 'utf-8').split(' ')[0].trim();

  return {
    valid: actualHash === storedHash,
    actualHash, storedHash, size: data.length, file: path.basename(backupPath)
  };
}

function restoreLatestBackup() {
  // With better-sqlite3 (WAL), we can't easily overwrite the open DB file while it's in use (especially on Windows).
  // Steps:
  // 1. Close DB
  // 2. Overwrite file
  // 3. Re-open

  const all = listBackups();
  let files = [...all.manual, ...all.auto, ...all.archives];
  files.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (files.length === 0) throw new Error("Aucun backup trouvé");
  const best = files[0];

  let folder = BACKUP_DIR;
  if (best.filename.includes('archive')) folder = path.join(BACKUP_DIR, 'archives');
  const sourcePath = path.join(folder, best.filename);

  try {
    if (db) db.close();

    // Copy file
    fs.copyFileSync(sourcePath, DB_PATH);

    // Re-open
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    recoveryMode = false;
    return { success: true, filename: best.filename };
  } catch (e) {
    console.error("Restore failed:", e);
    // Try to re-open anyway if possible
    try { db = new Database(DB_PATH); db.pragma('journal_mode = WAL'); } catch (ex) { }
    throw e;
  }
}

// ═══════════════════ RECOVERY ═══════════════════

function isRecoveryMode() { return recoveryMode; }

async function disableRecoveryMode() {
  recoveryMode = false;
  await seedInitialData();
  // No saveDb needed
}

// ═══════════════════ AUDIT LOG ═══════════════════

function logAudit(userId, userName, action, entite, entiteId, details) {
  try {
    // async execution to not block main thread? 
    // better-sqlite3 is fast enough for sync writes usually, but let's keep it safe.
    // If high volume, maybe batch?
    const stmt = db.prepare('INSERT INTO audit_log (utilisateur_id, utilisateur_nom, action, entite, entite_id, details) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(userId || 0, userName || 'system', action, entite || '', entiteId || 0, details || '');
  } catch (e) {
    console.error('Erreur audit log:', e.message);
  }
}

// ═══════════════════ CREATION TABLES & DATA ═══════════════════

function createTables() {
  // Note: Same Schema essentially, just executed via wrapper
  const schemas = [
    `CREATE TABLE IF NOT EXISTS succursales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            adresse TEXT DEFAULT '',
            ville TEXT DEFAULT '',
            telephone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            ice TEXT DEFAULT '',
            actif INTEGER DEFAULT 1,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    `CREATE TABLE IF NOT EXISTS utilisateurs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT DEFAULT '',
            email TEXT UNIQUE,
            login TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'caissier',
            succursale_id INTEGER DEFAULT 1,
            pin TEXT DEFAULT '',
            actif INTEGER DEFAULT 1,
            derniere_connexion DATETIME,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (succursale_id) REFERENCES succursales(id)
        )`,
    `CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            couleur TEXT DEFAULT '#e67e22',
            icone TEXT DEFAULT '🍞',
            image TEXT DEFAULT '',
            ordre INTEGER DEFAULT 0,
            actif INTEGER DEFAULT 1
        )`,
    `CREATE TABLE IF NOT EXISTS taxes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            taux REAL NOT NULL,
            par_defaut INTEGER DEFAULT 0,
            actif INTEGER DEFAULT 1
        )`,
    `CREATE TABLE IF NOT EXISTS produits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prix_ht REAL NOT NULL,
            prix_ttc REAL NOT NULL,
            categorie_id INTEGER,
            taxe_id INTEGER DEFAULT 1,
            image TEXT DEFAULT '',
            code_barre TEXT DEFAULT '',
            description TEXT DEFAULT '',
            cout_revient REAL DEFAULT 0,
            unite TEXT DEFAULT 'piece',
            poids_net REAL DEFAULT 0,
            parent_id INTEGER,
            variante_label TEXT DEFAULT '',
            variante_attributs TEXT DEFAULT '{}',
            dlc DATE,
            alerte_dlc_jours INTEGER DEFAULT 7,
            prix_gros REAL DEFAULT 0,
            prix_semi_gros REAL DEFAULT 0,
            est_favori INTEGER DEFAULT 0,
            actif INTEGER DEFAULT 1,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (categorie_id) REFERENCES categories(id),
            FOREIGN KEY (taxe_id) REFERENCES taxes(id)
        )`,
    `CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            telephone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            adresse TEXT DEFAULT '',
            points_fidelite INTEGER DEFAULT 0,
            total_achats REAL DEFAULT 0,
            nb_visites INTEGER DEFAULT 0,
            niveau TEXT DEFAULT 'bronze',
            notes TEXT DEFAULT '',
            solde_credit REAL DEFAULT 0,
            credit_max REAL DEFAULT 500,
            type_tarif TEXT DEFAULT 'particulier',
            actif INTEGER DEFAULT 1,
            date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    `CREATE TABLE IF NOT EXISTS remises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'pourcentage',
            valeur REAL NOT NULL,
            condition_min REAL DEFAULT 0,
            date_debut DATE,
            date_fin DATE,
            heure_debut TEXT DEFAULT '',
            heure_fin TEXT DEFAULT '',
            jours_semaine TEXT DEFAULT '',
            categorie_id INTEGER,
            produit_id INTEGER,
            actif INTEGER DEFAULT 1,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    `CREATE TABLE IF NOT EXISTS commandes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT NOT NULL UNIQUE,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            statut TEXT DEFAULT 'en_cours',
            sous_total REAL DEFAULT 0,
            total_tva REAL DEFAULT 0,
            remise_montant REAL DEFAULT 0,
            remise_type TEXT DEFAULT '',
            total REAL DEFAULT 0,
            mode_paiement TEXT DEFAULT '',
            montant_recu REAL DEFAULT 0,
            monnaie_rendue REAL DEFAULT 0,
            client_id INTEGER,
            client_nom TEXT DEFAULT '',
            table_numero TEXT DEFAULT '',
            type_commande TEXT DEFAULT 'sur_place',
            type_tarif TEXT DEFAULT 'particulier',
            pourboire REAL DEFAULT 0,
            numero_facture TEXT DEFAULT '',
            hash_integrite TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            utilisateur_id INTEGER,
            succursale_id INTEGER DEFAULT 1,
            points_gagnes INTEGER DEFAULT 0,
            montant_especes REAL DEFAULT 0,
            montant_carte REAL DEFAULT 0,
            session_id INTEGER,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
            FOREIGN KEY (succursale_id) REFERENCES succursales(id),
            FOREIGN KEY (session_id) REFERENCES sessions_caisse(id)
        )`,
    `CREATE TABLE IF NOT EXISTS commande_lignes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commande_id INTEGER NOT NULL,
            produit_id INTEGER NOT NULL,
            nom_produit TEXT DEFAULT '',
            quantite INTEGER DEFAULT 1,
            prix_unitaire_ht REAL NOT NULL,
            prix_unitaire_ttc REAL NOT NULL,
            taux_tva REAL DEFAULT 0,
            montant_tva REAL DEFAULT 0,
            sous_total_ht REAL NOT NULL,
            sous_total_ttc REAL NOT NULL,
            remise REAL DEFAULT 0,
            type_tarif TEXT DEFAULT 'particulier',
            notes TEXT DEFAULT '',
            FOREIGN KEY (commande_id) REFERENCES commandes(id),
            FOREIGN KEY (produit_id) REFERENCES produits(id)
        )`,
    `CREATE TABLE IF NOT EXISTS sessions_caisse (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            utilisateur_id INTEGER,
            succursale_id INTEGER DEFAULT 1,
            date_ouverture DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_fermeture DATETIME,
            fond_caisse REAL DEFAULT 0,
            total_especes REAL DEFAULT 0,
            total_carte REAL DEFAULT 0,
            total_ventes REAL DEFAULT 0,
            nb_commandes INTEGER DEFAULT 0,
            montant_reel REAL DEFAULT 0,
            ecart REAL DEFAULT 0,
            notes TEXT DEFAULT '',
            statut TEXT DEFAULT 'ouverte',
            total_pourboires REAL DEFAULT 0,
            FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
            FOREIGN KEY (succursale_id) REFERENCES succursales(id)
        )`,
    `CREATE TABLE IF NOT EXISTS mouvements_caisse (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            type TEXT NOT NULL,
            montant REAL NOT NULL,
            motif TEXT DEFAULT '',
            utilisateur_id INTEGER,
            date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
            succursale_id INTEGER DEFAULT 1,
            FOREIGN KEY(session_id) REFERENCES sessions_caisse(id)
        )`,
    `CREATE TABLE IF NOT EXISTS stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produit_id INTEGER NOT NULL,
            succursale_id INTEGER DEFAULT 1,
            quantite REAL DEFAULT 0,
            seuil_alerte REAL DEFAULT 5,
            unite TEXT DEFAULT 'unité',
            derniere_maj DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produit_id) REFERENCES produits(id),
            FOREIGN KEY (succursale_id) REFERENCES succursales(id)
        )`,
    `CREATE TABLE IF NOT EXISTS mouvements_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produit_id INTEGER NOT NULL,
            succursale_id INTEGER DEFAULT 1,
            type TEXT NOT NULL,
            quantite REAL NOT NULL,
            quantite_avant REAL DEFAULT 0,
            quantite_apres REAL DEFAULT 0,
            motif TEXT DEFAULT '',
            reference TEXT DEFAULT '',
            utilisateur_id INTEGER,
            date_mouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produit_id) REFERENCES produits(id),
            FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        )`,
    `CREATE TABLE IF NOT EXISTS fournisseurs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            contact TEXT DEFAULT '',
            telephone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            adresse TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            actif INTEGER DEFAULT 1,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    `CREATE TABLE IF NOT EXISTS depenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categorie TEXT NOT NULL,
            montant REAL NOT NULL,
            description TEXT DEFAULT '',
            fournisseur_id INTEGER,
            mode_paiement TEXT DEFAULT 'especes',
            date_depense DATE DEFAULT CURRENT_DATE,
            utilisateur_id INTEGER,
            succursale_id INTEGER DEFAULT 1,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
            FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            utilisateur_id INTEGER,
            utilisateur_nom TEXT DEFAULT '',
            action TEXT NOT NULL,
            entite TEXT DEFAULT '',
            entite_id INTEGER,
            details TEXT DEFAULT '',
            ip TEXT DEFAULT '',
            date_action DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
    `CREATE TABLE IF NOT EXISTS parametres (
            cle TEXT PRIMARY KEY,
            valeur TEXT NOT NULL,
            description TEXT DEFAULT ''
        )`,
    `CREATE TABLE IF NOT EXISTS credits_client (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            commande_id INTEGER,
            montant REAL NOT NULL,
            type TEXT NOT NULL DEFAULT 'debit',
            description TEXT DEFAULT '',
            utilisateur_id INTEGER,
            date_operation DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (commande_id) REFERENCES commandes(id),
            FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        )`,
    `CREATE TABLE IF NOT EXISTS livraisons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commande_id INTEGER NOT NULL,
            adresse TEXT NOT NULL DEFAULT '',
            telephone TEXT DEFAULT '',
            zone TEXT DEFAULT '',
            frais_livraison REAL DEFAULT 0,
            statut TEXT DEFAULT 'en_preparation',
            livreur_id INTEGER,
            notes TEXT DEFAULT '',
            date_livraison_prevue DATETIME,
            date_livraison_reelle DATETIME,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (commande_id) REFERENCES commandes(id),
            FOREIGN KEY (livreur_id) REFERENCES utilisateurs(id)
        )`
  ];

  db.transaction(() => {
    for (const sql of schemas) {
      db.prepare(sql).run();
    }

    // MIGRATIONS (SAFE)
    const migrations = [
      'ALTER TABLE produits ADD COLUMN prix_ht REAL DEFAULT 0',
      'ALTER TABLE produits ADD COLUMN prix_ttc REAL DEFAULT 0',
      'ALTER TABLE produits ADD COLUMN taxe_id INTEGER DEFAULT 1',
      'ALTER TABLE produits ADD COLUMN code_barre TEXT DEFAULT ""',
      'ALTER TABLE produits ADD COLUMN cout_revient REAL DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN sous_total REAL DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN total_tva REAL DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN remise_montant REAL DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN remise_type TEXT DEFAULT ""',
      'ALTER TABLE commandes ADD COLUMN montant_recu REAL DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN monnaie_rendue REAL DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN client_id INTEGER',
      'ALTER TABLE commandes ADD COLUMN table_numero TEXT DEFAULT ""',
      'ALTER TABLE commandes ADD COLUMN type_commande TEXT DEFAULT "sur_place"',
      'ALTER TABLE commandes ADD COLUMN utilisateur_id INTEGER',
      'ALTER TABLE commandes ADD COLUMN succursale_id INTEGER DEFAULT 1',
      'ALTER TABLE commandes ADD COLUMN points_gagnes INTEGER DEFAULT 0',
      'ALTER TABLE commandes ADD COLUMN hash_integrite TEXT DEFAULT ""',
      'ALTER TABLE commandes ADD COLUMN numero_facture TEXT DEFAULT ""',
      'ALTER TABLE commandes ADD COLUMN pourboire REAL DEFAULT 0',
      'ALTER TABLE sessions_caisse ADD COLUMN total_pourboires REAL DEFAULT 0',
      'ALTER TABLE clients ADD COLUMN solde_credit REAL DEFAULT 0',
      'ALTER TABLE clients ADD COLUMN credit_max REAL DEFAULT 500',
      "ALTER TABLE produits ADD COLUMN unite TEXT DEFAULT 'piece'",
      'ALTER TABLE produits ADD COLUMN poids_net REAL DEFAULT 0',
      'ALTER TABLE produits ADD COLUMN parent_id INTEGER',
      "ALTER TABLE produits ADD COLUMN variante_label TEXT DEFAULT ''",
      "ALTER TABLE produits ADD COLUMN variante_attributs TEXT DEFAULT '{}'",
      'ALTER TABLE produits ADD COLUMN dlc DATE',
      'ALTER TABLE produits ADD COLUMN alerte_dlc_jours INTEGER DEFAULT 7',
      'ALTER TABLE produits ADD COLUMN prix_gros REAL DEFAULT 0',
      'ALTER TABLE produits ADD COLUMN prix_semi_gros REAL DEFAULT 0',
      "ALTER TABLE clients ADD COLUMN type_tarif TEXT DEFAULT 'particulier'",
      "ALTER TABLE commandes ADD COLUMN type_tarif TEXT DEFAULT 'particulier'",
      "ALTER TABLE commande_lignes ADD COLUMN type_tarif TEXT DEFAULT 'particulier'",
      "ALTER TABLE categories ADD COLUMN image TEXT DEFAULT ''",
      "ALTER TABLE produits ADD COLUMN image TEXT DEFAULT ''",
      "ALTER TABLE produits ADD COLUMN est_favori INTEGER DEFAULT 0"
    ];

    for (const migr of migrations) {
      try { db.prepare(migr).run(); } catch (e) { }
    }

  })();
}

async function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM utilisateurs').get();
  const hasUsers = userCount && userCount.c > 0;

  if (hasUsers) {
    db.prepare("INSERT OR IGNORE INTO parametres (cle, valeur, description) VALUES ('setup_completed', '1', 'Setup initial effectué')").run();
    db.prepare("INSERT OR IGNORE INTO parametres (cle, valeur, description) VALUES ('type_commerce', 'boulangerie', 'Type de commerce')").run();
  } else {
    db.prepare("INSERT OR IGNORE INTO parametres (cle, valeur, description) VALUES ('setup_completed', '0', 'Setup initial effectué')").run();
    db.prepare("INSERT OR IGNORE INTO parametres (cle, valeur, description) VALUES ('type_commerce', '', 'Type de commerce')").run();
  }

  const defaultParams = [
    ['nom_commerce', '', 'Nom du commerce'],
    ['adresse', '', 'Adresse'],
    ['telephone', '', 'Téléphone'],
    ['ice', '', 'Identifiant Commun de l\'Entreprise'],
    ['identifiant_fiscal', '', 'Identifiant Fiscal (IF)'],
    ['registre_commerce', '', 'Registre de Commerce (RC)'],
    ['numero_patente', '', 'Numéro de Patente'],
    ['cnss', '', 'Numéro CNSS'],
    ['raison_sociale', '', 'Raison sociale officielle'],
    ['devise', 'DH', 'Devise'],
    ['tva_defaut', '20', 'Taux TVA par défaut (%)'],
    ['points_par_dh', '1', 'Points de fidélité par DH dépensé'],
    ['seuil_points_cadeau', '500', 'Points nécessaires pour un cadeau'],
    ['ticket_footer', 'Merci de votre visite !', 'Message pied de ticket'],
    ['ticket_header', '', 'Message en-tête de ticket'],
    ['auto_backup', '1', 'Backup automatique activé'],
    ['ticket_show_logo', '1', 'Afficher logo/nom commerce'],
    ['ticket_show_adresse', '1', 'Afficher adresse'],
    ['ticket_show_telephone', '1', 'Afficher téléphone'],
    ['ticket_show_ice', '1', 'Afficher ICE'],
    ['ticket_show_caissier', '1', 'Afficher nom caissier'],
    ['ticket_show_articles', '1', 'Afficher détail articles'],
    ['ticket_show_tva_detail', '1', 'Afficher détail TVA par ligne'],
    ['ticket_show_ht', '1', 'Afficher sous-total HT'],
    ['ticket_show_monnaie', '1', 'Afficher monnaie rendue'],
    ['ticket_show_points', '1', 'Afficher points fidélité'],
    ['ticket_show_client', '1', 'Afficher nom client'],
    ['ticket_show_type_cmd', '0', 'Afficher type commande'],
    ['ticket_show_header', '1', 'Afficher en-tête personnalisé'],
    ['ticket_show_footer', '1', 'Afficher pied de page'],
    ['ticket_show_date_heure', '1', 'Afficher date et heure'],
    ['ticket_show_numero', '1', 'Afficher numéro commande'],
    ['ticket_show_mode_paiement', '1', 'Afficher mode de paiement'],
    ['ticket_show_remise', '1', 'Afficher remise'],
    ['ticket_font_size', '13', 'Taille police ticket (px)'],
    ['ticket_largeur', '300', 'Largeur ticket (px)'],
    ['ticket_message_promo', '', 'Message promotionnel ticket'],
    ['feature_tables', '0', 'Gestion des tables'],
    ['feature_kds', '0', 'Kitchen Display System'],
    ['feature_code_barres', '1', 'Scan code-barres'],
    ['feature_livraison', '1', 'Commandes en livraison'],
    ['feature_emporter', '1', 'Commandes à emporter'],
    ['feature_sur_place', '0', 'Commandes sur place'],
    ['feature_fidelite', '1', 'Programme de fidélité'],
    ['feature_pourboire', '0', 'Pourboires'],
    ['feature_dlc', '1', 'Gestion des DLC'],
    ['feature_credit', '1', 'Gestion crédit client'],
    ['theme_couleur_primaire', '#2c3e50', 'Couleur primaire'],
    ['theme_couleur_accent', '#3498db', 'Couleur accent'],
    ['theme_header_gradient', 'linear-gradient(135deg, #2c3e50, #34495e)', 'Gradient header'],
    ['type_commerce', 'retail', 'Type de commerce'],
    ['types_commande', '["emporter","livraison"]', 'Types de commande actifs'],
    ['paiement_cheque', '1', 'Activer paiement par chèque'],
    ['paiement_virement', '1', 'Activer paiement par virement']
  ];

  const insertParam = db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur, description) VALUES (?, ?, ?)');
  const executeParams = db.transaction((params) => {
    for (const [cle, valeur, desc] of params) {
      insertParam.run(cle, valeur, desc);
    }
  });
  executeParams(defaultParams);
}

function applyBusinessProfile(profileId, commerceInfo, adminInfo) {
  const profile = getProfile(profileId);
  if (!profile) throw new Error(`Profil inconnu: ${profileId}`);

  console.log(`  🏪 Application du profil "${profile.nom}"...`);

  // Disable FK checks before starting the transaction for cleanup
  db.pragma('foreign_keys = OFF');

  // Use transaction for consistency
  const tf = db.transaction(() => {
    // 0. Clean old data for a fresh setup if needed
    const tablesToWipe = [
      'inventory_lines', 'inventory_sessions', 'commande_lignes', 'livraisons',
      'credits_client', 'mouvements_stock', 'mouvements_caisse', 'stock',
      'commandes', 'sessions_caisse', 'clients', 'produits', 'categories',
      'depenses', 'remises', 'audit_log'
    ];

    for (const table of tablesToWipe) {
      try {
        // Check if table exists before delete to avoid errors
        const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
        if (exists) db.prepare(`DELETE FROM ${table}`).run();
      } catch (e) {
        console.warn(`Could not wipe table ${table}:`, e.message);
      }
    }

    // 1. Succursale
    db.prepare(`INSERT OR IGNORE INTO succursales (id, nom, adresse, ville, telephone, ice)
              VALUES (1, ?, ?, ?, ?, ?)`).run(
      commerceInfo.nom || profile.nom,
      commerceInfo.adresse || '',
      commerceInfo.ville || '',
      commerceInfo.telephone || '',
      commerceInfo.ice || ''
    );

    // 2. Admin
    const adminHash = bcrypt.hashSync(adminInfo.password || 'admin2026', 10);
    db.prepare(`INSERT OR REPLACE INTO utilisateurs (nom, prenom, login, password_hash, role, succursale_id)
              VALUES (?, ?, ?, ?, 'admin', 1)`).run(
      adminInfo.nom || 'Administrateur',
      adminInfo.prenom || '',
      adminInfo.login || 'admin',
      adminHash
    );

    // Caissier
    const caissierHash = bcrypt.hashSync('caisse123', 10);
    db.prepare(`INSERT OR REPLACE INTO utilisateurs (nom, prenom, login, password_hash, role, succursale_id)
              VALUES ('Caissier', 'Principal', 'caissier', ?, 'caissier', 1)`).run(caissierHash);

    // 3. Taxes
    const insertTaxe = db.prepare('INSERT OR REPLACE INTO taxes (id, nom, taux, par_defaut, actif) VALUES (?,?,?,?,1)');
    for (const taxe of profile.taxes) {
      insertTaxe.run(taxe.id, taxe.nom, taxe.taux, taxe.par_defaut);
    }

    // 4. Catégories
    const catIdMap = {};
    const insertCat = db.prepare('INSERT INTO categories (nom, couleur, icone, ordre) VALUES (?,?,?,?)');
    for (const cat of profile.categories) {
      const info = insertCat.run(cat.nom, cat.couleur, cat.icone, cat.ordre);
      catIdMap[cat.nom] = info.lastInsertRowid;
    }

    // 5. Produits
    const getTaxeRate = db.prepare('SELECT taux FROM taxes WHERE id = ?');
    const insertProd = db.prepare('INSERT INTO produits (nom, prix_ht, prix_ttc, categorie_id, taxe_id) VALUES (?,?,?,?,?)');

    for (const [catNom, produits] of Object.entries(profile.produits)) {
      const catId = catIdMap[catNom];
      if (!catId) continue;
      for (const p of produits) {
        const taxeId = p.taxe_idx || 1;
        const taxeRow = getTaxeRate.get(taxeId);
        const taux = taxeRow ? taxeRow.taux : 0;
        const prixHt = +(p.prix_ttc / (1 + taux / 100)).toFixed(2);
        insertProd.run(p.nom, prixHt, p.prix_ttc, catId, taxeId);
      }
    }

    // 6. Stock
    const allProds = db.prepare('SELECT id FROM produits').all();
    const insertStock = db.prepare('INSERT OR IGNORE INTO stock (produit_id, succursale_id, quantite, seuil_alerte) VALUES (?, 1, 100, 10)');
    for (const row of allProds) {
      insertStock.run(row.id);
    }

    // 7. Params
    const paramUpdates = {
      setup_completed: '1',
      type_commerce: profileId,
      nom_commerce: commerceInfo.nom || profile.nom,
      adresse: commerceInfo.adresse || '',
      telephone: commerceInfo.telephone || '',
      ice: commerceInfo.ice || '',
      ville: commerceInfo.ville || '',
      theme_couleur_primaire: profile.couleur_primaire,
      theme_couleur_accent: profile.couleur_accent,
      theme_header_gradient: profile.header_gradient,
    };

    if (profile.parametres_defaults) Object.assign(paramUpdates, profile.parametres_defaults);
    if (profile.ticket_defaults) Object.assign(paramUpdates, profile.ticket_defaults);
    if (profile.features) {
      for (const [key, val] of Object.entries(profile.features)) {
        paramUpdates[`feature_${key}`] = val ? '1' : '0';
      }
    }
    if (profile.types_commande) paramUpdates.types_commande = JSON.stringify(profile.types_commande);

    const upsertParam = db.prepare('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)');
    for (const [cle, valeur] of Object.entries(paramUpdates)) {
      upsertParam.run(cle, String(valeur));
    }

  });

  // Exec transaction
  try {
    tf();
  } catch (err) {
    console.error("❌ Erreur critique lors de l'application du profil métier:", err.message);
    db.pragma('foreign_keys = ON'); // Re-enable anyway
    throw err;
  }

  db.pragma('foreign_keys = ON');

  console.log(`  ✅ Profil "${profile.nom}" appliqué avec succès !`);
  return { success: true, profile: profileId };
}

function isSetupCompleted() {
  if (!db) return false;
  try {
    const result = db.prepare("SELECT valeur FROM parametres WHERE cle = 'setup_completed'").get();
    return result && result.valeur === '1';
  } catch (e) {
    return false;
  }
}

module.exports = {
  getDb, resetDb, queryAll, queryOne, run,
  runTransaction,
  transaction,
  saveDb, createBackup, createArchiveBackup, // saveDb is no-op
  verifyBackupIntegrity, listBackups, logAudit,
  applyBusinessProfile, isSetupCompleted,
  isRecoveryMode, disableRecoveryMode, restoreLatestBackup
};
