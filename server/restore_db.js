/**
 * Script de restauration de base de données à partir de backups automatiques ou manuels.
 * Utilise fs pour copier le fichier de backup vers pos.db.
 */
const fs = require('fs');
const path = require('path');

const SERVER_DIR = __dirname;
const BACKUP_DIR = path.join(SERVER_DIR, 'backups');
const DB_PATH = path.join(SERVER_DIR, 'pos.db');

console.log('📂 Restauration de la base de données...');

if (!fs.existsSync(BACKUP_DIR)) {
    console.error('❌ Dossier de backup introuvable !');
    process.exit(1);
}

// 1. Trouver le dernier backup
const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db') && !f.includes('archive')) // Ignorer archives DGI
    .sort()
    .reverse();

if (files.length === 0) {
    // Check if we can use an archive as a fallback?
    // Let's check archives
    const archiveFiles = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db') && f.includes('archive'))
        .sort()
        .reverse();

    if (archiveFiles.length > 0) {
        console.log('⚠️ Aucun backup standard trouvé, utilisation de la dernière archive DGI...');
        files.push(archiveFiles[0]);
    } else {
        console.error('❌ Aucun fichier de backup (.db) trouvé, ni standard ni archive !');
        process.exit(1);
    }
}

const lastBackup = files[0];
const source = path.join(BACKUP_DIR, lastBackup);

console.log(`✅ Dernier backup trouvé : ${lastBackup}`);

// 2. Copier le fichier
try {
    // Backup de la version actuelle "cassée" si elle existe (au cas où)
    if (fs.existsSync(DB_PATH)) {
        const corruptedPath = path.join(SERVER_DIR, 'pos.db.corrupted.' + Date.now());
        // Clean up WAL/SHM to avoid confusion (we replicate clean state)
        try { if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal'); } catch (e) { }
        try { if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm'); } catch (e) { }

        fs.copyFileSync(DB_PATH, corruptedPath);
        console.log(`⚠️  Base actuelle sauvegardée sous ${path.basename(corruptedPath)}`);
    }

    // Ensure server is not locking the file if possible (node-sqlite3 usually locks, sql.js loads in memory so file might be free if process killed)
    // If the user runs this script manually while server is off, it should work.

    fs.copyFileSync(source, DB_PATH);
    console.log('🎉 Restauration réussie !');
    console.log('👉 Le fichier pos.db a été remplacé par le backup.');
    console.log('👉 Veuillez redémarrer le serveur pour appliquer les changements.');
} catch (e) {
    console.error('❌ Erreur lors de la copie :', e.message);
    if (e.code === 'EBUSY') {
        console.error('👉 Le fichier est verrouillé. Assurez-vous que le serveur est ARRÊTÉ.');
    }
}
