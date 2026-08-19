const express = require('express');
const router = express.Router();
const { asyncHandler, queryAll, run } = require('../middleware');

let activeOrders = {};

/**
 * GET /waiter - Show waiter interface (redirige vers la vue HTML)
 */
router.get('/', asyncHandler(async (req, res) => {
  res.redirect('/waiter.html');
}));

/**
 * POST /waiter/creer - Create new order for a table
 */
router.post('/creer', asyncHandler(async (req, res) => {
  const { tableId } = req.body;

  if (!tableId) {
    return res.status(400).json({ error: 'ID table requis' });
  }

  // Check if table already has an open order
  const existing = await queryAll(
    'SELECT id FROM commandes WHERE table_id = ? AND statut = \'ouverte\'',
    [tableId]
  );

  if (existing.length > 0) {
    return res.status(400).json({ error: 'Cette table a déjà une commande ouverte' });
  }

  // Create new order
  const result = await run(
    `INSERT INTO commandes (table_id, statut, date_creation, utilisateur_id) VALUES (?, 'ouverte', datetime('now'), ?)`,
    [tableId, req.user.id]
  );

  activeOrders[result.lastID] = {
    tableId,
    lignes: [],
    totalTTC: 0,
    statut: 'ouverte'
  };

  res.json({ 
    success: true, 
    orderId: result.lastID,
    message: 'Commande créée avec succès'
  });
}));

/**
 * POST /waiter/ajouter - Add item to current order
 */
router.post('/ajouter', asyncHandler(async (req, res) => {
  const { produitId, quantite, categorieId } = req.body;

  if (!produitId || !quantite) {
    return res.status(400).json({ error: 'Produit et quantité requis' });
  }

  // Verify product exists and get price
  const produit = await queryOne(
    'SELECT * FROM produits WHERE id = ? AND actif = 1',
    [produitId]
  );

  if (!produit) {
    return res.status(404).json({ error: 'Produit introuvable ou inactif' });
  }

  // Get active order (last one)
  const orderId = Object.keys(activeOrders).pop() || null;
  if (!orderId) {
    return res.status(400).json({ error: 'Aucune commande en cours. Veuillez en créer une nouvelle.' });
  }

  const order = activeOrders[orderId];

  // Add line to order
  const ligneExistee = order.lignes.find(l => l.produitId === produitId);
  if (ligneExistee) {
    ligneExistee.quantite += quantite;
  } else {
    order.lignes.push({
      produitId,
      nom: produit.nom,
      prixHT: produit.prix_ttc,
      quantite,
      prixTTC: produit.prix_ttc * quantite
    });
  }

  // Recalculate total
  order.totalTTC = order.lignes.reduce((sum, l) => sum + l.prixTTC, 0);
  order.lignes.forEach(l => l.prixTTCTotal = l.prixTTC);

  res.json({ 
    success: true, 
    orderId,
    ligne: order.lignes[order.lignes.length - 1],
    totalTTC: order.totalTTC,
    message: 'Ligne ajoutée à la commande'
  });
}));

/**
 * POST /waiter/regler - Process payment and print receipt
 */
router.post('/regler', asyncHandler(async (req, res) => {
  const { modePaiement } = req.body;

  if (!modePaiement) {
    return res.status(400).json({ error: 'Mode de paiement requis' });
  }

  const orderId = Object.keys(activeOrders).pop();
  if (!orderId) {
    return res.status(400).json({ error: 'Aucune commande en cours' });
  }

  const order = activeOrders[orderId];

  // Update order status to réglée
  await run(
    `UPDATE commandes SET statut = 'reglée', date_reglement = datetime('now') WHERE id = ?`,
    [orderId]
  );

  // Calculate TVA if needed for receipt
  const tvaRate = 10; // Example: 10% TVA
  const tvaMontant = (order.totalTTC * tvaRate) / 100;
  const totalAvTVA = order.totalTTC - tvaMontant;

  // Mark as printed in DB
  try {
    await run(
      `INSERT INTO impression (type, reference, contenu, created_at) VALUES ('receipt', ?, datetime('now'))`,
      [orderId]
    );
  } catch (err) {
    console.error('Erreur insertion impression:', err);
  }

  // Clear the order from active memory
  delete activeOrders[orderId];

  res.json({ 
    success: true, 
    orderId,
    totalTTC: order.totalTTC,
    modePaiement,
    message: 'Commande réglée et receipt enregistré'
  });
}));

/**
 * GET /waiter/tables - Get table statuses
 */
router.get('/tables', asyncHandler(async (req, res) => {
  const tables = await queryAll('SELECT id, numero, actif FROM tables ORDER BY numero');
  res.json({ success: true, tables });
}));

/**
 * Helper: Get a single row from DB
 */
function queryOne(sql, params) {
  const db = global.db;
  const row = db.prepare(sql).get(...params);
  return row;
}

module.exports = router;