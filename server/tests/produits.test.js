/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests: Produits & Catégories
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

// ═══════════════════ CATÉGORIES ═══════════════════

describe('GET /pos/api/categories', () => {
  test('devrait lister les catégories (auth requise)', async () => {
    const res = await request(app)
      .get('/pos/api/categories')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0); // Catégories du profil café
  });

  test('devrait refuser sans authentification', async () => {
    const res = await request(app).get('/pos/api/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /pos/api/categories', () => {
  test('devrait créer une catégorie', async () => {
    const res = await request(app)
      .post('/pos/api/categories')
      .set(authHeaders())
      .send({ nom: 'Catégorie Test', couleur: '#ff5500', icone: '🧪', ordre: 99 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.success).toBe(true);
  });

  test('devrait refuser sans nom', async () => {
    const res = await request(app)
      .post('/pos/api/categories')
      .set(authHeaders())
      .send({ couleur: '#ff5500' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('devrait refuser une couleur mal formatée', async () => {
    const res = await request(app)
      .post('/pos/api/categories')
      .set(authHeaders())
      .send({ nom: 'Bad Color', couleur: 'not-a-color' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });
});

// ═══════════════════ PRODUITS ═══════════════════

describe('GET /pos/api/produits', () => {
  test('devrait lister les produits avec détails', async () => {
    const res = await request(app)
      .get('/pos/api/produits')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const produit = res.body[0];
      expect(produit).toHaveProperty('nom');
      expect(produit).toHaveProperty('prix_ttc');
      expect(produit).toHaveProperty('categorie_nom');
      expect(produit).toHaveProperty('taux_tva');
      expect(produit).toHaveProperty('stock_quantite');
    }
  });

  test('devrait filtrer par catégorie', async () => {
    const res = await request(app)
      .get('/pos/api/produits?categorie_id=1')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('devrait filtrer par recherche', async () => {
    const res = await request(app)
      .get('/pos/api/produits?search=cafe')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /pos/api/produits', () => {
  let taxeId;

  beforeAll(async () => {
    // Récupérer une taxe existante
    const taxesRes = await request(app)
      .get('/pos/api/taxes')
      .set(authHeaders());
    if (taxesRes.body.length > 0) {
      taxeId = taxesRes.body[0].id;
    }
  });

  test('devrait créer un produit avec calcul TVA', async () => {
    const res = await request(app)
      .post('/pos/api/produits')
      .set(authHeaders())
      .send({
        nom: 'Produit Test',
        prix_ttc: 25.00,
        categorie_id: 1,
        taxe_id: taxeId || 1,
        stock_initial: 50,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.success).toBe(true);
  });

  test('devrait refuser sans nom', async () => {
    const res = await request(app)
      .post('/pos/api/produits')
      .set(authHeaders())
      .send({ prix_ttc: 10 });

    expect(res.status).toBe(400);
  });

  test('devrait refuser un prix négatif', async () => {
    const res = await request(app)
      .post('/pos/api/produits')
      .set(authHeaders())
      .send({ nom: 'Bad Price', prix_ttc: -5 });

    expect(res.status).toBe(400);
  });

  test('devrait refuser sans prix', async () => {
    const res = await request(app)
      .post('/pos/api/produits')
      .set(authHeaders())
      .send({ nom: 'No Price' });

    expect(res.status).toBe(400);
  });
});
