/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests: Authentification
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

describe('POST /pos/api/auth/login', () => {
  test('devrait réussir avec des identifiants valides', async () => {
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'admin_test', password: 'test1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.login).toBe('admin_test');
    expect(res.body.user.role).toBe('admin');
  });

  test('devrait refuser un mot de passe incorrect', async () => {
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'admin_test', password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('devrait refuser un utilisateur inexistant', async () => {
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'inexistant', password: 'test1234' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('devrait rejeter une requête sans login', async () => {
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ password: 'test1234' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('devrait rejeter une requête sans mot de passe', async () => {
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'admin_test' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /pos/api/auth/me', () => {
  test('devrait retourner le profil utilisateur authentifié', async () => {
    const res = await request(app)
      .get('/pos/api/auth/me')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('nom');
    expect(res.body).toHaveProperty('role');
    expect(res.body.login).toBe('admin_test');
  });

  test('devrait refuser sans token', async () => {
    const res = await request(app).get('/pos/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Token');
  });

  test('devrait refuser avec un token invalide', async () => {
    const res = await request(app)
      .get('/pos/api/auth/me')
      .set({ Authorization: 'Bearer invalid_token' });

    expect(res.status).toBe(401);
  });
});
