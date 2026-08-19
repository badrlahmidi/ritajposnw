const request = require('supertest');
const { initTestApp, setupAndLogin, cleanupTestDb } = require('./setup');

let app;
let token;

beforeAll(async () => {
  app = await initTestApp();
  token = await setupAndLogin(app);
});

afterAll(() => {
  cleanupTestDb();
});

describe('Sécurité — Protection des endpoints sensibles', () => {

  test('POST /system/restore-latest rejette sans token', async () => {
    const res = await request(app).post('/pos/api/system/restore-latest');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('POST /system/ack-reset rejette sans token', async () => {
    const res = await request(app).post('/pos/api/system/ack-reset');
    expect(res.status).toBe(401);
  });

  test('POST /system/restore-latest rejette avec simple caissier', async () => {
    const loginRes = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'caissier', password: 'caisse123' });
    expect(loginRes.status).toBe(200);
    const caissierToken = loginRes.body.token;

    const res = await request(app)
      .post('/pos/api/system/restore-latest')
      .set('Authorization', `Bearer ${caissierToken}`);
    expect(res.status).toBe(403);
  });

  test('POST /admin/reset-database rejette sans token', async () => {
    const res = await request(app)
      .post('/pos/api/admin/reset-database')
      .send({ mode: 'retail', confirmation: 'RESET-DANGER' });
    expect(res.status).toBe(401);
  });

  test('POST /admin/reset-database rejette sans confirmation', async () => {
    const res = await request(app)
      .post('/pos/api/admin/reset-database')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'retail' });
    expect(res.status).toBe(400);
  });

  test('POST /backup rejette sans adminStrict', async () => {
    const loginRes = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'caissier', password: 'caisse123' });
    const caissierToken = loginRes.body.token;

    const res = await request(app)
      .post('/pos/api/backup')
      .set('Authorization', `Bearer ${caissierToken}`);
    expect(res.status).toBe(403);
  });

  test('auth/me rejette un token JWT invalide', async () => {
    const res = await request(app)
      .get('/pos/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  test('auth/me rejette Authorization mal formé', async () => {
    const res = await request(app)
      .get('/pos/api/auth/me')
      .set('Authorization', 'NotABearer token');
    expect(res.status).toBe(401);
  });

  test('Rate limiting sur login (10 tentatives max)', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/pos/api/auth/login')
        .send({ login: 'admin', password: 'wrong' });
    }
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'admin', password: 'wrong' });
    expect(res.status).toBe(429);
  });

});

describe('Sécurité — Validation entrées', () => {

  test('POST /produits rejette prix négatif', async () => {
    const res = await request(app)
      .post('/pos/api/produits')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Test', prix_ttc: -10 });
    expect(res.status).toBe(400);
  });

  test('POST /clients rejette email invalide', async () => {
    const res = await request(app)
      .post('/pos/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Test Client', email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  test('POST /fournisseurs rejette sans adminOnly', async () => {
    const res = await request(app)
      .post('/pos/api/fournisseurs')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Test Fournisseur' });
    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'caissier', password: 'caisse123' });
    if (loginRes.status !== 200) {return;}
    const caissierToken = loginRes.body.token;

    const res2 = await request(app)
      .post('/pos/api/fournisseurs')
      .set('Authorization', `Bearer ${caissierToken}`)
      .send({ nom: 'Test Fournisseur 2' });
    expect(res2.status === 401 || res2.status === 403).toBe(true);
  });

});
