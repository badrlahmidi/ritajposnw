/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests: Commandes (flux complet)
 *  Test d'intégration: Commande → Paiement → Stock → Fidélité
 * ═══════════════════════════════════════════════════════════════
 */
const request = require('supertest');
const { initTestApp, setupAndLogin, authHeaders } = require('./setup');

let app;
let adminToken;

beforeAll(async () => {
  app = await initTestApp();
  adminToken = await setupAndLogin(app);
}, 30000);

describe('Flux complet: Commande → Paiement → Stock', () => {
  let produitId;
  let commandeId;
  let commandeNumero;
  let stockInitial;

  // --- Préparer un produit et vérifier son stock ---
  beforeAll(async () => {
    // Créer un produit de test
    const createRes = await request(app)
      .post('/pos/api/produits')
      .set(authHeaders())
      .send({
        nom: 'Intégration Test Produit',
        prix_ttc: 15.00,
        taxe_id: 1,
        stock_initial: 100,
      });
    produitId = createRes.body.id;

    // Vérifier stock initial
    const stockRes = await request(app)
      .get('/pos/api/stock')
      .set(authHeaders());

    const stockEntry = stockRes.body.find(s => s.produit_id === produitId);
    stockInitial = stockEntry ? stockEntry.quantite : 100;
  });

  test('1. Ouvrir la caisse', async () => {
    // Fermer si déjà ouverte
    const statut = await request(app)
      .get('/pos/api/caisse/statut')
      .set(authHeaders());

    if (statut.body.statut !== 'fermee') {
      await request(app)
        .post('/pos/api/caisse/fermer')
        .set(authHeaders())
        .send({ montant_reel: 0 });
    }

    const res = await request(app)
      .post('/pos/api/caisse/ouvrir')
      .set(authHeaders())
      .send({ fond_caisse: 500 });

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('ouverte');
    expect(res.body.fond_caisse).toBe(500);
  });

  test('2. Créer une commande avec paiement', async () => {
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders())
      .send({
        lignes: [
          { produit_id: produitId, quantite: 3 },
        ],
        mode_paiement: 'especes',
        montant_recu: 100,
        type_commande: 'sur_place',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('numero');
    expect(res.body).toHaveProperty('total');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.monnaie_rendue).toBeGreaterThanOrEqual(0);
    expect(res.body.lignes.length).toBe(1);

    commandeId = res.body.id;
    commandeNumero = res.body.numero;
  });

  test('3. Vérifier la décrémentation du stock', async () => {
    const stockRes = await request(app)
      .get('/pos/api/stock')
      .set(authHeaders());

    const stockEntry = stockRes.body.find(s => s.produit_id === produitId);
    expect(stockEntry).toBeDefined();
    expect(stockEntry.quantite).toBe(stockInitial - 3);
  });

  test('4. Récupérer les détails de la commande', async () => {
    const res = await request(app)
      .get(`/pos/api/commandes/${commandeId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commandeId);
    expect(res.body.numero).toBe(commandeNumero);
    expect(res.body.statut).toBe('payee');
    expect(res.body.lignes).toHaveLength(1);
    expect(res.body.lignes[0].quantite).toBe(3);
  });

  test('5. Lister les commandes du jour', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/pos/api/commandes?date=${today}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('6. Annuler la commande et vérifier restauration stock', async () => {
    const annulRes = await request(app)
      .put(`/pos/api/commandes/${commandeId}/annuler`)
      .set(authHeaders());

    expect(annulRes.status).toBe(200);
    expect(annulRes.body.success).toBe(true);

    // Vérifier que le stock est restauré
    const stockRes = await request(app)
      .get('/pos/api/stock')
      .set(authHeaders());

    const stockEntry = stockRes.body.find(s => s.produit_id === produitId);
    expect(stockEntry).toBeDefined();
    expect(stockEntry.quantite).toBe(stockInitial);
  });

  test('7. Vérifier les mouvements de stock', async () => {
    const res = await request(app)
      .get(`/pos/api/stock/mouvements?produit_id=${produitId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // sortie + entrée
  });

  test('8. Fermer la caisse', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/fermer')
      .set(authHeaders())
      .send({ montant_reel: 500, notes: 'Fermeture de test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('ecart');
  });
});

describe('Validation des commandes', () => {
  test('devrait refuser une commande sans articles', async () => {
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders())
      .send({
        lignes: [],
        mode_paiement: 'especes',
      });

    expect(res.status).toBe(400);
  });

  test('devrait refuser un mode de paiement invalide', async () => {
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders())
      .send({
        lignes: [{ produit_id: 1, quantite: 1 }],
        mode_paiement: 'bitcoin',
      });

    expect(res.status).toBe(400);
  });

  test('devrait refuser un type de commande invalide', async () => {
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders())
      .send({
        lignes: [{ produit_id: 1, quantite: 1 }],
        type_commande: 'drone_delivery',
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /pos/api/stats/jour', () => {
  test('devrait retourner les statistiques du jour', async () => {
    const res = await request(app)
      .get('/pos/api/stats/jour')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nb_commandes');
    expect(res.body).toHaveProperty('total_ventes');
    expect(res.body).toHaveProperty('total_tva');
    expect(res.body).toHaveProperty('top_produits');
    expect(res.body).toHaveProperty('ventes_par_heure');
    expect(res.body).toHaveProperty('benefice_brut');
  });
});
