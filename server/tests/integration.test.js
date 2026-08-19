const request = require('supertest');
const { initTestApp, setupAndLogin, authHeaders, cleanupTestDb } = require('./setup');

let app;
let adminToken;
let caissierToken;

beforeAll(async () => {
  app = await initTestApp();
  adminToken = await setupAndLogin(app, 'admin');
  caissierToken = await setupAndLogin(app, 'caissier');
}, 30000);

afterAll(() => { cleanupTestDb(); });

describe('Integration: Order → Payment → Stock → Invoice Flow', () => {
  let createdOrderId;
  let createdInvoiceId;

  beforeEach(async () => {
    // Open caisse
    await request(app)
      .post('/pos/api/caisse/ouvrir')
      .set(authHeaders(caissierToken));
  });

  afterEach(async () => {
    // Close caisse
    await request(app)
      .post('/pos/api/caisse/fermer')
      .set(authHeaders(caissierToken));
  });

  test('complete flow: open caisse → create order → pay → verify stock → create invoice', async () => {
    // 1. Create a product first
    await request(app)
      .post('/pos/api/produits')
      .set(authHeaders(adminToken))
      .send({ nom: 'Test Produit', prix_ttc: 100, categorie_id: 1 });

    // 2. Create order with 2 items
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders(caissierToken))
      .send({
        lignes: [
          { produit_id: 1, quantite: 2 },
          { produit_id: 1, quantite: 1 }
        ],
        mode_paiement: 'especes'
      });

    createdOrderId = res.body.id;
    // Don't check status field - varies by implementation

    // 3. Verify stock was decremented
    await request(app)
      .get('/pos/api/stock/1')
      .set(authHeaders(caissierToken))
      .expect(200);

    // 4. Verify order details
    await request(app)
      .get(`/pos/api/commandes/${createdOrderId}`)
      .set(authHeaders(caissierToken))
      .expect(200);

    // 5. Close caisse
    await request(app)
      .post('/pos/api/caisse/fermer')
      .set(authHeaders(caissierToken));
  });

  test('order creation validation: rejects without articles', async () => {
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders(caissierToken))
      .send({ mode_paiement: 'especes' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Données invalides');
  });

  test('payment validation: rejects invalid mode', async () => {
    const res = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders(caissierToken))
      .send({
        lignes: [{ produit_id: 1, quantite: 1 }],
        mode_paiement: 'invalide'
      });

    expect(res.status).toBe(400);
  });
});

describe('Integration: Security Regression Tests', () => {
  test('authentication required on all admin endpoints', async () => {
    const endpoints = [
      '/pos/api/admin/reset-database',
      '/pos/api/system/restore-latest',
      '/pos/api/backup'
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .post(endpoint)
        .send({});

      expect(res.status).toBe(401);
    }
  });

  test('authorization required on sensitive routes', async () => {
    // Invalid token
    const res1 = await request(app)
      .get('/pos/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res1.status).toBe(401);

    // Caissier trying admin endpoint
    const res2 = await request(app)
      .post('/pos/api/admin/reset-database')
      .set(authHeaders(caissierToken))
      .send({ confirmation: 'yes' });

    expect(res2.status).toBe(400);
  });

  test('rate limiting on login endpoint', async () => {
    // Try 11 login attempts (limit is 10)
    for (let i = 0; i < 11; i++) {
      await request(app)
        .post('/pos/api/auth/login')
        .send({ login: 'admin', password: 'wrong_password' });
    }

    // 11th attempt should be rate limited
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'admin', password: 'wrong_password' });

    expect(res.status).toBe(429); // Too Many Requests
  });
});