/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests: Clients, Stock, Dépenses
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

// ═══════════════════ CLIENTS ═══════════════════

describe('CRUD Clients', () => {
  let clientId;

  test('devrait créer un client', async () => {
    const res = await request(app)
      .post('/pos/api/clients')
      .set(authHeaders())
      .send({
        nom: 'Ahmed Bennani',
        telephone: '0661234567',
        email: 'ahmed@test.ma',
        adresse: 'Bd Mohammed V, Casablanca',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.success).toBe(true);
    clientId = res.body.id;
  });

  test('devrait lister les clients', async () => {
    const res = await request(app)
      .get('/pos/api/clients')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('devrait chercher un client par nom', async () => {
    const res = await request(app)
      .get('/pos/api/clients?search=Ahmed')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].nom).toContain('Ahmed');
  });

  test('devrait mettre à jour un client', async () => {
    const res = await request(app)
      .put(`/pos/api/clients/${clientId}`)
      .set(authHeaders())
      .send({
        nom: 'Ahmed Bennani (VIP)',
        telephone: '0661234567',
        email: 'ahmed.vip@test.ma',
        adresse: 'Bd Mohammed V, Casablanca',
        notes: 'Client VIP',
        points_fidelite: 100,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('devrait refuser un client sans nom', async () => {
    const res = await request(app)
      .post('/pos/api/clients')
      .set(authHeaders())
      .send({ telephone: '0661234567' });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════ STOCK ═══════════════════

describe('Gestion du Stock', () => {
  test('devrait lister le stock', async () => {
    const res = await request(app)
      .get('/pos/api/stock')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('produit_nom');
      expect(res.body[0]).toHaveProperty('quantite');
      expect(res.body[0]).toHaveProperty('seuil_alerte');
    }
  });

  test('devrait lister les alertes stock', async () => {
    const res = await request(app)
      .get('/pos/api/stock/alertes')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('devrait ajuster le stock manuellement', async () => {
    // Trouver un produit
    const prodRes = await request(app)
      .get('/pos/api/produits')
      .set(authHeaders());

    if (prodRes.body.length === 0) return;
    const produitId = prodRes.body[0].id;

    const res = await request(app)
      .put(`/pos/api/stock/${produitId}`)
      .set(authHeaders())
      .send({
        quantite: 200,
        seuil_alerte: 15,
        motif: 'Réapprovisionnement test',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════ DÉPENSES ═══════════════════

describe('Gestion des Dépenses', () => {
  test('devrait créer une dépense', async () => {
    const res = await request(app)
      .post('/pos/api/depenses')
      .set(authHeaders())
      .send({
        categorie: 'Fournitures',
        montant: 250.50,
        description: 'Achat serviettes',
        mode_paiement: 'especes',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('devrait lister les dépenses', async () => {
    const res = await request(app)
      .get('/pos/api/depenses')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('devrait refuser une dépense sans catégorie', async () => {
    const res = await request(app)
      .post('/pos/api/depenses')
      .set(authHeaders())
      .send({ montant: 100 });

    expect(res.status).toBe(400);
  });

  test('devrait refuser une dépense sans montant', async () => {
    const res = await request(app)
      .post('/pos/api/depenses')
      .set(authHeaders())
      .send({ categorie: 'Fournitures' });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════ FOURNISSEURS ═══════════════════

describe('Gestion des Fournisseurs', () => {
  test('devrait créer un fournisseur', async () => {
    const res = await request(app)
      .post('/pos/api/fournisseurs')
      .set(authHeaders())
      .send({
        nom: 'Fournisseur Maroc SA',
        contact: 'M. Alami',
        telephone: '0522112233',
        email: 'contact@fournisseur.ma',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('devrait lister les fournisseurs', async () => {
    const res = await request(app)
      .get('/pos/api/fournisseurs')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ═══════════════════ PARAMÈTRES ═══════════════════

describe('Paramètres', () => {
  test('devrait lire les paramètres', async () => {
    const res = await request(app)
      .get('/pos/api/parametres')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  test('devrait mettre à jour un paramètre', async () => {
    const res = await request(app)
      .put('/pos/api/parametres')
      .set(authHeaders())
      .send({ monnaie: 'MAD', devise_symbole: 'DH' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════ AUDIT ═══════════════════

describe('Audit Log', () => {
  test('devrait retourner les logs d\'audit', async () => {
    const res = await request(app)
      .get('/pos/api/audit')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('action');
    expect(res.body[0]).toHaveProperty('utilisateur_nom');
    expect(res.body[0]).toHaveProperty('date_action');
  });
});
