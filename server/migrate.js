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

console.log("🏁 Migration terminée.");
db.close();
