/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Routes Cuisine / KDS
 *  Kitchen Display System : flux de commandes en cuisine.
 *
 *  Monté sur : /api/cuisine
 * ═══════════════════════════════════════════════════════════════
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware } = require('../middleware');
const { queryAll, queryOne, run } = require('../db');
const { broadcast } = require('../services/realtime');
const { ok, fail } = require('../utils/response');

/**
 * GET /api/cuisine/commandes-actives
 * Flux KDS : toutes les commandes envoyées en cuisine ou en service,
 * regroupées par cours (entrée / plat / dessert / boisson).
 */
router.get('/commandes-actives', authMiddleware, asyncHandler((req, res) => {
  const commandes = queryAll(`
    SELECT c.id, c.numero, c.table_id, c.nb_couverts, c.statut_service,
           c.created_at, t.numero AS table_numero
    FROM commandes c
    LEFT JOIN tables t ON t.id = c.table_id
    WHERE c.statut_service IN ('envoyee_cuisine', 'servie')
    ORDER BY c.created_at ASC
  `);

  const result = commandes.map(cmd => {
    const lignes = queryAll(`
      SELECT cl.*, p.nom AS produit_nom
      FROM commande_lignes cl
      LEFT JOIN produits p ON p.id = cl.produit_id
      WHERE cl.commande_id = ? AND cl.statut_ligne IN ('en_attente','preparee')
      ORDER BY cl.cours, cl.id
    `, [cmd.id]);

    const parCours = { entree: [], plat: [], dessert: [], boisson: [] };
    for (const l of lignes) {
      const cours = parCours[l.cours] ? l.cours : 'plat';
      parCours[cours].push(l);
    }

    return { ...cmd, lignes_par_cours: parCours };
  });

  return ok(res, result);
}));

/**
 * PATCH /api/cuisine/lignes/:id/statut
 * La cuisine marque une ligne comme préparée ou servie.
 */
router.patch('/lignes/:id/statut', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  const VALID = ['en_attente', 'preparee', 'servie', 'annulee'];
  if (!VALID.includes(statut)) {
    return fail(res, 400, 'INVALID_STATUT', `Statut invalide. Valeurs : ${VALID.join(', ')}`);
  }

  const ligne = queryOne('SELECT * FROM commande_lignes WHERE id = ?', [id]);
  if (!ligne) return fail(res, 404, 'LIGNE_NOT_FOUND', 'Ligne introuvable');

  run('UPDATE commande_lignes SET statut_ligne = ? WHERE id = ?', [statut, id]);
  broadcast('ligne.prete', { ligne_id: Number(id), statut, commande_id: ligne.commande_id });

  // Si toutes les lignes de la commande sont prêtes → mettre à jour statut_service
  const enAttente = queryOne(`
    SELECT COUNT(*) AS c FROM commande_lignes
    WHERE commande_id = ? AND statut_ligne = 'en_attente'
  `, [ligne.commande_id]);

  if (enAttente && enAttente.c === 0) {
    run("UPDATE commandes SET statut_service='servie' WHERE id = ? AND statut_service='envoyee_cuisine'",
      [ligne.commande_id]);
    broadcast('commande.servie', { commande_id: ligne.commande_id });
  }

  return ok(res, { id: Number(id), statut });
}));

module.exports = router;
