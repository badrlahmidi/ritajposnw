const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { JWT_SECRET, JWT_EXPIRES } = config;
const { asyncHandler, authMiddleware, adminStrict, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit, createBackup, createArchiveBackup, listBackups, verifyBackupIntegrity, isSetupCompleted, isRecoveryMode, restoreLatestBackup, disableRecoveryMode, applyBusinessProfile } = require('../db');
const { getProfilesList, getProfile } = require('../business-profiles');
const v = require('../validators');

// Check Recovery Status
router.get('/system/recovery-status', (req, res) => {
    res.json({
        recovery_needed: isRecoveryMode(),
        message: isRecoveryMode() ? 'Base de données manquante ou corrompue.' : 'Système opérationnel'
    });
});

// Restore Latest Backup (Recovery Mode)
router.post('/system/restore-latest', asyncHandler((req, res) => {
    if (!isRecoveryMode()) return res.status(400).json({ error: 'Système non en mode récupération' });
    try {
        const result = restoreLatestBackup();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}));

// Acknowledge Reset (Factory Reset)
router.post('/system/ack-reset', asyncHandler((req, res) => {
    if (!isRecoveryMode()) return res.status(400).json({ error: 'Système non en mode récupération' });
    disableRecoveryMode();
    res.json({ success: true, message: 'Système réinitialisé. Redirection vers Setup.' });
}));


// Setup Status
router.get('/setup/status', asyncHandler((req, res) => {
    const completed = isSetupCompleted();
    res.json({ completed });
}));

// Setup Profiles
router.get('/setup/profiles', asyncHandler((req, res) => {
    res.json(getProfilesList());
}));

// Complete Setup
router.post('/setup/complete', v.setupCompleteRules, v.handleValidation, asyncHandler((req, res) => {
    if (isSetupCompleted()) {
        return res.status(400).json({ error: 'Le setup a déjà été effectué' });
    }

    const { profile_id, commerce, admin } = req.body;
    if (!profile_id) return res.status(400).json({ error: 'Profil métier requis' });
    if (!admin || !admin.login || !admin.password) return res.status(400).json({ error: 'Identifiants admin requis (login + password)' });

    const profile = getProfile(profile_id);
    if (!profile) return res.status(400).json({ error: `Profil inconnu: ${profile_id}` });

    applyBusinessProfile(profile_id, commerce || {}, admin);

    const user = queryOne('SELECT * FROM utilisateurs WHERE login = ?', [admin.login]);
    if (!user) return res.status(500).json({ error: 'Erreur création utilisateur admin' });

    const token = jwt.sign(
        { id: user.id, login: user.login, nom: user.nom, prenom: user.prenom, role: user.role, succursale_id: user.succursale_id },
        JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );

    logAudit(user.id, user.nom, 'SETUP', 'systeme', 0, `Setup initial — profil: ${profile.nom}`);

    res.json({
        success: true,
        token,
        user: { id: user.id, nom: user.nom, prenom: user.prenom, login: user.login, role: user.role, succursale_id: user.succursale_id },
        profile: { id: profile.id, nom: profile.nom, icone: profile.icone }
    });
}));


// Paramètres Publics
router.get('/parametres/public', asyncHandler((req, res) => {
    const allParams = queryAll("SELECT cle, valeur FROM parametres WHERE cle LIKE 'theme_%' OR cle LIKE 'feature_%' OR cle = 'app_nom' OR cle = 'app_logo' OR cle LIKE 'ticket_%' OR cle = 'monnaie'");
    const result = {};
    allParams.forEach(p => { result[p.cle] = p.valeur; });
    res.json(result);
}));

// Paramètres Tous (Auth)
router.get('/parametres', authMiddleware, asyncHandler((req, res) => {
    const params = queryAll('SELECT * FROM parametres');
    const obj = {};
    for (const p of params) obj[p.cle] = p.valeur;
    res.json(obj);
}));

// Update Paramètres
router.put('/parametres', authMiddleware, adminStrict, asyncHandler((req, res) => {
    for (const [cle, valeur] of Object.entries(req.body)) {
        run('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)', [cle, String(valeur)]);
    }
    res.json({ success: true });
}));

// Reset Database
router.post('/admin/reset-database', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const { mode, confirmation } = req.body;
    if (confirmation !== 'RESET-DANGER') return res.status(400).json({ error: 'Code de confirmation invalide' });

    const tablesToClear = [
        'commandes', 'commande_lignes', 'livraisons',
        'stock', 'mouvements_stock',
        'clients',
        'produits', 'categories', 'remises', 'depenses',
        'sessions_caisse', 'audit_log'
    ];

    tablesToClear.forEach(t => run(`DELETE FROM ${t}`));

    run("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('app_mode', ?)", [mode]);

    if (mode === 'restaurant') {
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Entrées', '🥗', '#2ecc71', 1, 1)");
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Plats', '🥩', '#e67e22', 2, 1)");
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Desserts', '🍰', '#9b59b6', 3, 1)");
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Boissons', '🥤', '#3498db', 4, 1)");
        run("INSERT INTO tables_restaurant (numero, zone, capacite, position_x, position_y) VALUES ('101', 'salle', 4, 100, 100), ('102', 'salle', 2, 300, 100), ('201', 'terrasse', 4, 100, 100)");

    } else if (mode === 'retail') {
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Fruits & Légumes', '🍎', '#2ecc71', 1, 1)");
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Épicerie', '🥫', '#f1c40f', 2, 1)");
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Produits Frais', '🧀', '#3498db', 3, 1)");
        run("INSERT INTO categories (nom, icone, couleur, ordre, actif) VALUES ('Non-Alimentaire', '🧼', '#95a5a6', 4, 1)");

        run("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('type_commerce', 'superette')");
        run("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('types_commande', '[\"standard\"]')");
        run("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('feature_sur_place', '0')");
        run("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('feature_emporter', '0')");
        run("INSERT OR REPLACE INTO parametres (cle, valeur) VALUES ('feature_livraison', '0')");
    }

    logAudit(req.user.id, req.user.nom, 'RESET_DB', 'systeme', 0, `Base réinitialisée (Mode: ${mode})`);
    res.json({ success: true, message: `Base réinitialisée en mode ${mode}` });
}));

// Backup Manual
router.post('/backup', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const backupPath = createBackup('manual');
    logAudit(req.user.id, req.user.nom, 'BACKUP', 'systeme', 0, 'Backup manuel créé');
    res.json({ success: true, path: backupPath });
}));

// Backup Archive
router.post('/backup/archive', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const archivePath = createArchiveBackup();
    logAudit(req.user.id, req.user.nom, 'ARCHIVE', 'systeme', 0, 'Archive DGI créée');
    res.json({ success: true, path: archivePath });
}));

// List Backups
router.get('/backup/list', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const backups = listBackups();
    res.json(backups);
}));

// Verify Backup
router.post('/backup/verify', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Nom de fichier requis' });
    const safeName = path.basename(filename);
    const backupDir = path.join(__dirname, '..', 'backups'); // Adjust path since we are in runs/
    let fullPath = path.join(backupDir, safeName);

    if (!fs.existsSync(fullPath)) {
        fullPath = path.join(backupDir, 'archives', safeName);
    }
    const result = verifyBackupIntegrity(fullPath);
    res.json(result);
}));

// Download Backup
router.get('/backup/download/:filename', authMiddleware, adminStrict, (req, res) => {
    const filename = req.params.filename;
    if (!filename) return res.status(400).send('Filename required');
    const safeName = path.basename(filename);
    const backupDir = path.join(__dirname, '..', 'backups');
    let fullPath = path.join(backupDir, safeName);

    if (!fs.existsSync(fullPath)) {
        fullPath = path.join(backupDir, 'archives', safeName);
    }

    if (!fs.existsSync(fullPath)) return res.status(404).send('File not found');

    res.download(fullPath);
});

// Audit Log
router.get('/audit', authMiddleware, adminStrict, asyncHandler((req, res) => {
    const { date_debut, date_fin, action, limit: lim } = req.query;
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    if (date_debut) { query += ' AND DATE(date_action) >= ?'; params.push(date_debut); }
    if (date_fin) { query += ' AND DATE(date_action) <= ?'; params.push(date_fin); }
    if (action) { query += ' AND action = ?'; params.push(action); }
    query += ' ORDER BY date_action DESC LIMIT ?';
    params.push(parseInt(lim) || 200);
    res.json(queryAll(query, params));
}));

module.exports = router;
