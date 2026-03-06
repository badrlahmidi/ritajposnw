const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { asyncHandler, authMiddleware, adminOnly, adminStrict } = require('../middleware');
const { queryAll, queryOne, run, logAudit } = require('../db');
const v = require('../validators');

router.get('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const users = queryAll('SELECT id, nom, prenom, login, email, role, succursale_id, actif, derniere_connexion, date_creation FROM utilisateurs ORDER BY nom');
    res.json(users);
}));

router.post('/', authMiddleware, adminStrict, v.createUserRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, prenom, login, password, email, role, succursale_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const result = run(
        'INSERT INTO utilisateurs (nom, prenom, login, password_hash, email, role, succursale_id) VALUES (?,?,?,?,?,?,?)',
        [nom, prenom || '', login, hash, email || '', role || 'caissier', succursale_id || 1]
    );
    logAudit(req.user.id, req.user.nom, 'CREATION', 'utilisateur', result.lastInsertRowid, `Utilisateur ${login} créé`);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, adminStrict, v.updateUserRules, v.handleValidation, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { nom, prenom, login, password, email, role, succursale_id, actif } = req.body;

    let fields = [];
    let params = [];

    const add = (col, val) => {
        if (val !== undefined) {
            fields.push(`${col}=?`);
            params.push(val);
        }
    };

    add('nom', nom);
    add('prenom', prenom);
    add('login', login);
    add('email', email);
    add('role', role);
    add('succursale_id', succursale_id);
    add('actif', actif);

    if (password) {
        fields.push('password_hash=?');
        params.push(bcrypt.hashSync(password, 10));
    }

    if (fields.length === 0) return res.json({ success: true, message: 'Aucune modification' });

    params.push(id);
    run(`UPDATE utilisateurs SET ${fields.join(', ')} WHERE id = ?`, params);

    logAudit(req.user.id, req.user.nom, 'MODIFICATION', 'utilisateur', id, `Utilisateur modifié`);
    res.json({ success: true });
}));

module.exports = router;
