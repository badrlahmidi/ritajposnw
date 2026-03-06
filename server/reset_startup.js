const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'pos.db'));
try {
    db.prepare("UPDATE parametres SET valeur = '0' WHERE cle = 'setup_completed'").run();
    console.log("✅ Application reset to setup mode.");
} catch (e) {
    console.error("❌ Error resetting:", e.message);
} finally {
    db.close();
}
