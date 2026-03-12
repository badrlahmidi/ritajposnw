const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryAll, queryOne, run, logAudit, saveDb } = require('../db');
const v = require('../validators');
const facture = require('../facture');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    const { search, all } = req.query;
    let query = 'SELECT * FROM clients';
    if (!all) query += ' WHERE actif = 1';
    else query += ' WHERE 1=1';

    const params = [];
    if (search) { query += ' AND (nom LIKE ? OR telephone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY nom LIMIT 200';
    res.json(queryAll(query, params));
}));

router.post('/', authMiddleware, v.createClientRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, telephone, email, adresse, notes, type_tarif } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis' });
    const result = run('INSERT INTO clients (nom, telephone, email, adresse, notes, type_tarif) VALUES (?,?,?,?,?,?)',
        [nom, telephone || '', email || '', adresse || '', notes || '', type_tarif || 'particulier']);
    logAudit(req.user.id, req.user.nom, 'CREATION', 'client', result.lastInsertRowid, `Client "${nom}" créé`);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const { nom, telephone, email, adresse, notes, points_fidelite, type_tarif, actif, solde_credit, credit_max } = req.body;

    let fields = [];
    let params = [];

    const add = (col, val) => {
        if (val !== undefined) {
            fields.push(`${col}=?`);
            params.push(val);
        }
    };

    add('nom', nom);
    add('telephone', telephone);
    add('email', email);
    add('adresse', adresse);
    add('notes', notes);
    add('points_fidelite', points_fidelite);
    add('type_tarif', type_tarif);
    add('actif', actif);
    add('solde_credit', solde_credit);
    add('credit_max', credit_max);

    if (fields.length === 0) return res.json({ success: true, message: 'Aucun changement' });

    params.push(id);
    run(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, params);

    res.json({ success: true });
}));

// Historique crédit
router.get('/:id/credits', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const credits = queryAll('SELECT * FROM credits_client WHERE client_id = ? ORDER BY date_operation DESC', [id]);
    const client = queryOne('SELECT solde_credit, credit_max FROM clients WHERE id = ?', [id]);
    res.json({ solde: client ? client.solde_credit : 0, credit_max: client ? client.credit_max : 500, operations: credits });
}));

// Ajouter un crédit manually
router.post('/:id/credits', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const { montant, type, description, commande_id } = req.body;
    if (!montant || montant <= 0) return res.status(400).json({ error: 'Montant requis' });

    const client = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });

    const opType = type || 'debit';
    if (opType === 'debit') {
        if (client.solde_credit + montant > (client.credit_max || 500)) {
            return res.status(400).json({ error: `Crédit max dépassé (${client.credit_max || 500} DH)` });
        }
        run('UPDATE clients SET solde_credit = solde_credit + ? WHERE id = ?', [montant, id]);
    } else {
        run('UPDATE clients SET solde_credit = MAX(0, solde_credit - ?) WHERE id = ?', [montant, id]);
    }

    run('INSERT INTO credits_client (client_id, commande_id, montant, type, description, utilisateur_id) VALUES (?,?,?,?,?,?)',
        [id, commande_id || null, montant, opType, description || '', req.user.id]);

    logAudit(req.user.id, req.user.nom, opType === 'debit' ? 'CREDIT_DEBIT' : 'CREDIT_PAIEMENT', 'client', id, `${opType}: ${montant} DH`);
    res.json({ success: true });
}));

// Régler la dette
router.post('/:id/regler-credit', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const { montant } = req.body;
    if (!montant || montant <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const client = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });

    run('UPDATE clients SET solde_credit = MAX(0, solde_credit - ?) WHERE id = ?', [montant, id]);
    run('INSERT INTO credits_client (client_id, montant, type, description, utilisateur_id) VALUES (?,?,?,?,?)',
        [id, montant, 'credit', `Paiement dette (Manuel)`, req.user.id]);

    logAudit(req.user.id, req.user.nom, 'REGLEMENT_CREDIT', 'client', id, `Règlement: ${montant} DH`);
    saveDb();
    res.json({ success: true, nouveau_solde: Math.max(0, client.solde_credit - montant) });
}));

// PDF Relevé
router.get('/:id/releve/pdf', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const client = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });

    const operations = queryAll('SELECT * FROM credits_client WHERE client_id = ? ORDER BY date_operation DESC', [id]);
    const paramsRows = queryAll('SELECT cle, valeur FROM parametres');
    const params = {};
    paramsRows.forEach(p => { params[p.cle] = p.valeur; });

    const doc = facture.genererReleveClientPDF({ client, operations, params });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="releve-${client.nom}.pdf"`);
    doc.pipe(res);
    doc.end();
}));

// Désactiver un client
router.delete('/:id', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    run('UPDATE clients SET actif = 0 WHERE id = ?', [id]);
    logAudit(req.user.id, req.user.nom, 'DESACTIVATION', 'client', id, `Client ${id} désactivé`);
    saveDb();
    res.json({ success: true });
}));

// Solde crédit d'un client spécifique (pour le widget panier)
router.get('/:id/credits', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const client = queryOne('SELECT id, nom, solde_credit FROM clients WHERE id = ?', [id]);
    if (!client) return res.status(404).json({ error: 'Client non trouvé' });
    res.json({ id: client.id, nom: client.nom, solde: client.solde_credit || 0 });
}));

// Liste des clients en dette (solde_credit > seuil)
router.get('/en-dette', authMiddleware, asyncHandler((req, res) => {
    const seuil = parseFloat(req.query.seuil) || 0;
    const clients = queryAll(
        'SELECT id, nom, telephone, solde_credit FROM clients WHERE solde_credit > ? AND actif = 1 ORDER BY solde_credit DESC',
        [seuil]
    );
    const total = queryOne('SELECT COALESCE(SUM(solde_credit), 0) as total FROM clients WHERE solde_credit > ? AND actif = 1', [seuil]);
    res.json({ clients, total_global: total.total || 0 });
}));

module.exports = router;
