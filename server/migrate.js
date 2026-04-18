const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'pos.db');

if (!fs.existsSync(DB_PATH)) {
    console.error("Base de données non trouvée à :", DB_PATH);
    process.exit(1);
}

const db = new Database(DB_PATH);

function addColumnIfNotExists(table, column, definition) {
    try {
        const info = db.prepare(`PRAGMA table_info(${table})`).all();
        const exists = info.some(c => c.name === column);
        if (!exists) {
            console.log(`Ajout de la colonne ${column} à la table ${table}...`);
            db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
            console.log(`✅ Colonne ${column} ajoutée.`);
        } else {
            console.log(`ℹ️ La colonne ${column} existe déjà dans la table ${table}.`);
        }
    } catch (e) {
        console.error(`❌ Erreur lors de l'ajout de ${column} à ${table}:`, e.message);
    }
}

console.log("🚀 Lancement de la migration de la base de données...");

// Table commandes
addColumnIfNotExists('commandes', 'session_id', 'INTEGER');
addColumnIfNotExists('commandes', 'montant_especes', 'REAL DEFAULT 0');
addColumnIfNotExists('commandes', 'montant_carte', 'REAL DEFAULT 0');

// Table sessions_caisse
addColumnIfNotExists('sessions_caisse', 'total_pourboires', 'REAL DEFAULT 0');

// ═════ NOUVELLES TABLES INVENTAIRE ═════
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS inventory_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_cloture DATETIME,
            statut TEXT DEFAULT 'active', -- active, cloturee
            notes TEXT,
            utilisateur_id INTEGER,
            succursale_id INTEGER
        )
    `).run();
    console.log("✅ Table inventory_sessions vérifiée/créée.");

    db.prepare(`
        CREATE TABLE IF NOT EXISTS inventory_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            produit_id INTEGER,
            quantite_theorique REAL,
            quantite_reelle REAL,
            ecart REAL,
            FOREIGN KEY(session_id) REFERENCES inventory_sessions(id) ON DELETE CASCADE
        )
    `).run();
    console.log("✅ Table inventory_lines vérifiée/créée.");
} catch (e) { console.error("Erreur création tables inventaire:", e.message); }

// ═════ MIGRATION v5.0 — RESTAURANT & CAFÉ ═════

// ─── Salles ──────────────────────────────────────────────────────────────────
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS salles (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            nom  TEXT NOT NULL,
            ordre INTEGER DEFAULT 0
        )
    `).run();
    console.log("✅ Table salles vérifiée/créée.");
} catch (e) { console.error("Erreur création table salles:", e.message); }

// ─── Tables ──────────────────────────────────────────────────────────────────
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tables (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            salle_id   INTEGER REFERENCES salles(id) ON DELETE SET NULL,
            numero     TEXT NOT NULL,
            capacite   INTEGER DEFAULT 4,
            x          REAL DEFAULT 0,
            y          REAL DEFAULT 0,
            statut     TEXT DEFAULT 'libre'
                          CHECK(statut IN ('libre','occupee','reservee','a_nettoyer'))
        )
    `).run();
    console.log("✅ Table tables vérifiée/créée.");
} catch (e) { console.error("Erreur création table tables:", e.message); }

// ─── Colonnes supplémentaires commandes ──────────────────────────────────────
addColumnIfNotExists('commandes', 'table_id',        'INTEGER');
addColumnIfNotExists('commandes', 'serveur_id',      'INTEGER');
addColumnIfNotExists('commandes', 'nb_couverts',     'INTEGER DEFAULT 0');
addColumnIfNotExists('commandes', 'statut_service',  "TEXT DEFAULT 'encaissee'");
addColumnIfNotExists('commandes', 'split_parent_id', 'INTEGER');

// ─── Colonnes supplémentaires commande_lignes ─────────────────────────────────
addColumnIfNotExists('commande_lignes', 'statut_ligne',   "TEXT DEFAULT 'en_attente'");
addColumnIfNotExists('commande_lignes', 'envoyee_at',     'DATETIME');
addColumnIfNotExists('commande_lignes', 'notes_cuisine',  'TEXT');
addColumnIfNotExists('commande_lignes', 'cours',          "TEXT DEFAULT 'plat'");
addColumnIfNotExists('commande_lignes', 'options_json',   'TEXT');

// ─── Imprimantes ─────────────────────────────────────────────────────────────
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS imprimantes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            nom             TEXT NOT NULL,
            type            TEXT NOT NULL CHECK(type IN ('ticket','cuisine','bar')),
            ip              TEXT,
            port            INTEGER DEFAULT 9100,
            categories_json TEXT,
            actif           INTEGER DEFAULT 1
        )
    `).run();
    console.log("✅ Table imprimantes vérifiée/créée.");
} catch (e) { console.error("Erreur création table imprimantes:", e.message); }

// ─── Réservations ─────────────────────────────────────────────────────────────
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS reservations (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id     INTEGER,
            table_id      INTEGER REFERENCES tables(id) ON DELETE SET NULL,
            datetime_resa TEXT NOT NULL,
            nb_personnes  INTEGER DEFAULT 2,
            statut        TEXT DEFAULT 'confirmee'
                              CHECK(statut IN ('confirmee','annulee','arrivee','terminee')),
            notes         TEXT,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    console.log("✅ Table reservations vérifiée/créée.");
} catch (e) { console.error("Erreur création table reservations:", e.message); }

// ─── Modifier Groups ──────────────────────────────────────────────────────────
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS modifier_groups (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nom         TEXT NOT NULL,
            min_choix   INTEGER DEFAULT 0,
            max_choix   INTEGER DEFAULT 1,
            obligatoire INTEGER DEFAULT 0
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS modifiers (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            nom      TEXT NOT NULL,
            prix     REAL DEFAULT 0,
            groupe_id INTEGER REFERENCES modifier_groups(id) ON DELETE CASCADE
        )
    `).run();
    db.prepare(`
        CREATE TABLE IF NOT EXISTS produit_modifier_groups (
            produit_id INTEGER,
            groupe_id  INTEGER,
            PRIMARY KEY (produit_id, groupe_id),
            FOREIGN KEY (groupe_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
        )
    `).run();
    console.log("✅ Tables modifiers vérifiées/créées.");
} catch (e) { console.error("Erreur création tables modifiers:", e.message); }

// ─── Happy Hours ──────────────────────────────────────────────────────────────
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS happy_hours (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            nom          TEXT NOT NULL,
            jours_json   TEXT NOT NULL,
            heure_debut  TEXT NOT NULL,
            heure_fin    TEXT NOT NULL,
            remise_pct   REAL NOT NULL,
            produits_json TEXT,
            actif        INTEGER DEFAULT 1
        )
    `).run();
    console.log("✅ Table happy_hours vérifiée/créée.");
} catch (e) { console.error("Erreur création table happy_hours:", e.message); }

// ─── Index performances ───────────────────────────────────────────────────────
try {
    db.prepare("CREATE INDEX IF NOT EXISTS idx_commandes_statut_service ON commandes(statut_service)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_commandes_table_id ON commandes(table_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_lignes_commande_id_statut ON commande_lignes(commande_id, statut_ligne)").run();
    console.log("✅ Index performances créés/vérifiés.");
} catch (e) { console.error("Erreur création index:", e.message); }

// ─── Migration données existantes ─────────────────────────────────────────────
try {
    const updated = db.prepare(`
        UPDATE commandes SET statut_service='encaissee'
        WHERE statut_service IS NULL
    `).run();
    if (updated.changes > 0) {
        console.log(`✅ ${updated.changes} commande(s) migrée(s) → statut_service='encaissee'.`);
    }
} catch (e) { console.error("Erreur migration commandes:", e.message); }

// ─── Migration type_commerce hors whitelist ───────────────────────────────────
try {
    const row = db.prepare("SELECT valeur FROM parametres WHERE cle='type_commerce'").get();
    if (row && ['boulangerie', 'superette', 'retail'].includes(row.valeur)) {
        db.prepare("UPDATE parametres SET valeur='cafe' WHERE cle='type_commerce'").run();
        console.warn(`⚠️  type_commerce '${row.valeur}' migré vers 'cafe' (profil non supporté en v5.0).`);
    }
} catch (e) { console.error("Erreur migration type_commerce:", e.message); }

console.log("🏁 Migration v5.0 terminée.");
db.close();
