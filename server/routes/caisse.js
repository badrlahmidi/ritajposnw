const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryOne, queryAll, run, logAudit } = require('../db');
const v = require('../validators');

router.get('/statut', authMiddleware, asyncHandler((req, res) => {
    const session = queryOne("SELECT sc.*, u.nom as utilisateur_nom FROM sessions_caisse sc LEFT JOIN utilisateurs u ON sc.utilisateur_id = u.id WHERE sc.statut = 'ouverte' AND sc.succursale_id = ?", [req.user.succursale_id || 1]);
    res.json(session || { statut: 'fermee' });
}));

router.post('/ouvrir', authMiddleware, v.openCashRegisterRules, v.handleValidation, asyncHandler((req, res) => {
    const { fond_caisse } = req.body;
    const existing = queryOne("SELECT * FROM sessions_caisse WHERE statut = 'ouverte' AND succursale_id = ?", [req.user.succursale_id || 1]);
    if (existing) return res.status(400).json({ error: 'Une caisse est déjà ouverte' });
    const result = run('INSERT INTO sessions_caisse (utilisateur_id, succursale_id, fond_caisse) VALUES (?,?,?)',
        [req.user.id, req.user.succursale_id || 1, fond_caisse || 0]);
    logAudit(req.user.id, req.user.nom, 'OUVERTURE_CAISSE', 'session_caisse', result.lastInsertRowid, `Fond: ${fond_caisse || 0} DH`);
    res.json({ id: result.lastInsertRowid, statut: 'ouverte', fond_caisse });
}));

router.post('/fermer', authMiddleware, v.closeCashRegisterRules, v.handleValidation, asyncHandler((req, res) => {
    const { montant_reel, notes } = req.body;
    const session = queryOne("SELECT * FROM sessions_caisse WHERE statut = 'ouverte' AND succursale_id = ?", [req.user.succursale_id || 1]);
    if (!session) return res.status(400).json({ error: 'Aucune caisse ouverte' });
    const mReel = parseFloat(montant_reel) || 0;
    const ecart = +(mReel - (session.fond_caisse + session.total_especes)).toFixed(2);
    run("UPDATE sessions_caisse SET statut='fermee', date_fermeture=CURRENT_TIMESTAMP, montant_reel=?, ecart=?, notes=? WHERE id=?",
        [mReel, ecart, notes || '', session.id]);
    logAudit(req.user.id, req.user.nom, 'FERMETURE_CAISSE', 'session_caisse', session.id,
        `Ventes: ${session.total_ventes} DH | Espèces: ${session.total_especes} DH | Carte: ${session.total_carte} DH | Écart: ${ecart} DH`);
    res.json({ success: true, id: session.id, total_ventes: session.total_ventes, total_especes: session.total_especes, total_carte: session.total_carte, ecart, nb_commandes: session.nb_commandes });
}));

router.get('/mouvements', authMiddleware, asyncHandler((req, res) => {
    const session = queryOne("SELECT * FROM sessions_caisse WHERE statut = 'ouverte' AND succursale_id = ?", [req.user.succursale_id || 1]);
    if (!session) return res.json([]);
    const mvts = queryAll("SELECT * FROM mouvements_caisse WHERE session_id = ? ORDER BY date_mouvement DESC", [session.id]);
    res.json(mvts);
}));

router.post('/mouvements', authMiddleware, asyncHandler((req, res) => {
    const { type, montant, motif, link_expense } = req.body; // type: 'depot', 'retrait'
    const session = queryOne("SELECT * FROM sessions_caisse WHERE statut = 'ouverte' AND succursale_id = ?", [req.user.succursale_id || 1]);
    if (!session) return res.status(400).json({ error: 'Aucune caisse ouverte' });

    if (!montant || montant <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const result = run("INSERT INTO mouvements_caisse (session_id, type, montant, motif, utilisateur_id, succursale_id) VALUES (?,?,?,?,?,?)",
        [session.id, type, montant, motif || '', req.user.id, req.user.succursale_id || 1]);

    logAudit(req.user.id, req.user.nom, type === 'depot' ? 'DEPOT_CAISSE' : 'RETRAIT_CAISSE', 'mouvements_caisse', session.id, `${montant} DH (${motif})`);

    // Auto-create expense if linked
    if (link_expense && type === 'retrait') {
        const expResult = run('INSERT INTO depenses (categorie, montant, description, mode_paiement, date_depense, utilisateur_id, succursale_id) VALUES (?,?,?,?,?,?,?)',
            ['Caisse', montant, motif || 'Retrait Caisse', 'especes', new Date().toISOString().slice(0, 10), req.user.id, req.user.succursale_id || 1]);
        logAudit(req.user.id, req.user.nom, 'DEPENSE_AUTO', 'depense', expResult.lastInsertRowid, `Auto depuis Retrait #${result.lastInsertRowid}: ${montant} DH`);
    }

    res.json({ success: true });
}));

module.exports = router;
