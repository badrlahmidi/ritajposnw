const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { JWT_SECRET, JWT_EXPIRES } = config;
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryOne, run, logAudit } = require('../db');
const v = require('../validators');

// Rate limiting sur l'authentification (anti brute-force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 tentatives max par IP
    message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', loginLimiter, v.loginRules, v.handleValidation, asyncHandler((req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Login et mot de passe requis' });

    const user = queryOne('SELECT * FROM utilisateurs WHERE login = ? AND actif = 1', [login]);
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    // Mettre à jour dernière connexion
    run('UPDATE utilisateurs SET derniere_connexion = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = jwt.sign(
        { id: user.id, login: user.login, nom: user.nom, prenom: user.prenom, role: user.role, succursale_id: user.succursale_id },
        JWT_SECRET, { expiresIn: JWT_EXPIRES }
    );

    logAudit(user.id, user.nom, 'CONNEXION', 'utilisateur', user.id, 'Connexion réussie');

    res.json({
        token,
        user: { id: user.id, nom: user.nom, prenom: user.prenom, login: user.login, role: user.role, succursale_id: user.succursale_id }
    });
}));

router.get('/me', authMiddleware, asyncHandler((req, res) => {
    const user = queryOne('SELECT id, nom, prenom, login, role, succursale_id FROM utilisateurs WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(user);
}));

module.exports = router;
