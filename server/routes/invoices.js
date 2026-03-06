const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryAll, queryOne, run, logAudit } = require('../db');
const facture = require('../facture');

// Export facture PDF
router.get('/:id/pdf', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const commande = queryOne('SELECT * FROM commandes WHERE id = ?', [id]);
    if (!commande) return res.status(404).json({ error: 'Commande non trouvée' });

    const lignes = queryAll('SELECT * FROM commande_lignes WHERE commande_id = ?', [id]);
    const paramsRows = queryAll('SELECT cle, valeur FROM parametres');
    const params = {};
    paramsRows.forEach(p => { params[p.cle] = p.valeur; });

    let client = null;
    if (commande.client_id) {
        client = queryOne('SELECT * FROM clients WHERE id = ?', [commande.client_id]);
    }

    if (!commande.hash_integrite) {
        commande.hash_integrite = facture.generateHash(commande, params.ice || '');
        run('UPDATE commandes SET hash_integrite = ? WHERE id = ?', [commande.hash_integrite, id]);
    }
    if (!commande.numero_facture) {
        commande.numero_facture = facture.genererNumeroFacture(commande.numero);
        run('UPDATE commandes SET numero_facture = ? WHERE id = ?', [commande.numero_facture, id]);
    }

    const doc = facture.genererFacturePDF({ commande, lignes, params, client });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${commande.numero_facture}.pdf"`);
    doc.pipe(res);
    doc.end();

    logAudit(req.user.id, req.user.nom, 'EXPORT_FACTURE_PDF', 'commande', id, `Facture ${commande.numero_facture}`);
}));

// Export facture groupée
router.post('/batch/pdf', authMiddleware, asyncHandler((req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'IDs requis' });

    const idList = ids.join(',');
    const commandes = queryAll(`SELECT * FROM commandes WHERE id IN (${idList}) ORDER BY date_creation ASC`);
    const lignes = queryAll(`
    SELECT cl.*, p.nom as produit_nom 
    FROM commande_lignes cl 
    LEFT JOIN produits p ON cl.produit_id = p.id 
    WHERE cl.commande_id IN (${idList})
  `);

    const paramsRows = queryAll('SELECT cle, valeur FROM parametres');
    const params = {};
    paramsRows.forEach(p => { params[p.cle] = p.valeur; });

    let client = null;
    const firstWithClient = commandes.find(c => c.client_id > 0);
    if (firstWithClient) {
        client = queryOne('SELECT * FROM clients WHERE id = ?', [firstWithClient.client_id]);
    }

    const doc = facture.genererFactureBatchPDF({ commandes, lignes, params, client });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="facture-groupee-${new Date().getTime()}.pdf"`);
    doc.pipe(res);
    doc.end();
}));

// Export JSON (DGI)
router.get('/:id/json', authMiddleware, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const commande = queryOne('SELECT * FROM commandes WHERE id = ?', [id]);
    if (!commande) return res.status(404).json({ error: 'Commande non trouvée' });

    const lignes = queryAll('SELECT * FROM commande_lignes WHERE commande_id = ?', [id]);
    const paramsRows = queryAll('SELECT cle, valeur FROM parametres');
    const params = {};
    paramsRows.forEach(p => { params[p.cle] = p.valeur; });

    let client = null;
    if (commande.client_id) {
        client = queryOne('SELECT * FROM clients WHERE id = ?', [commande.client_id]);
    }

    if (!commande.hash_integrite) {
        commande.hash_integrite = facture.generateHash(commande, params.ice || '');
        run('UPDATE commandes SET hash_integrite = ? WHERE id = ?', [commande.hash_integrite, id]);
    }
    if (!commande.numero_facture) {
        commande.numero_facture = facture.genererNumeroFacture(commande.numero);
        run('UPDATE commandes SET numero_facture = ? WHERE id = ?', [commande.numero_facture, id]);
    }

    const jsonData = facture.genererFactureJSON({ commande, lignes, params, client });
    res.json(jsonData);
}));

module.exports = router;
