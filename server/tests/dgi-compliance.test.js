const request = require('supertest');
const path = require('path');
const facture = require('../facture');
const { initTestApp, setupAndLogin, authHeaders, cleanupTestDb } = require('./setup');

let app;
let token;

beforeAll(async () => {
  app = await initTestApp();
  token = await setupAndLogin(app);
  await setupOrderAndInvoice();
});

afterAll(() => {
  cleanupTestDb();
});

let commandeId;
let numeroFacture;

async function setupOrderAndInvoice() {
  const h = authHeaders(token);
  await request(app).post('/pos/api/caisse/ouvrir').set(h).send({ fond_caisse: 500 });

  const paramsRes = await request(app).put('/pos/api/parametres').set(h).send({
    ice: '001234567000012',
    identifiant_fiscal: '1234567',
    registre_commerce: 'RC12345',
    numero_patente: 'PAT001',
    cnss: 'CNSS001',
    raison_sociale: 'RITAJ INFORMATIQUE SARL'
  });

  const produits = await request(app).get('/pos/api/produits').set(h);
  const produitId = produits.body[0]?.id;
  if (!produitId) {throw new Error('Aucun produit disponible');}

  const orderRes = await request(app).post('/pos/api/commandes').set(h).send({
    lignes: [{ produit_id: produitId, quantite: 2 }],
    mode_paiement: 'especes',
    montant_recu: 50,
    type_commande: 'sur_place',
    generate_facture: true
  });
  commandeId = orderRes.body.id;
  numeroFacture = orderRes.body.numero_facture;
}

describe('DGI — Facture PDF', () => {

  test('GET /facture/:id/pdf retourne un PDF valide', async () => {
    const h = authHeaders(token);
    const res = await request(app).get(`/pos/api/facture/${commandeId}/pdf`).set(h);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body instanceof Buffer).toBe(true);
  });

  test('GET /facture/:id/pdf rejette sans auth', async () => {
    const res = await request(app).get(`/pos/api/facture/${commandeId}/pdf`);
    expect(res.status).toBe(401);
  });

  test('GET /facture/:id/pdf retourne 404 pour commande inexistante', async () => {
    const h = authHeaders(token);
    const res = await request(app).get('/pos/api/facture/99999/pdf').set(h);
    expect(res.status).toBe(404);
  });

});

describe('DGI — Facture JSON', () => {

  test('GET /facture/:id/json retourne la structure DGI', async () => {
    const h = authHeaders(token);
    const res = await request(app).get(`/pos/api/facture/${commandeId}/json`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.facture).toBeDefined();
    expect(res.body.facture.numero).toMatch(/^FA-/);
    expect(res.body.facture.hash_integrite).toMatch(/^sha256:/);
    expect(res.body.facture.vendeur.ice).toBe('001234567000012');
    expect(res.body.facture.vendeur.identifiant_fiscal).toBe('1234567');
    expect(res.body.facture.totaux).toBeDefined();
    expect(res.body.facture.totaux.ventilation_tva).toBeInstanceOf(Array);
    expect(res.body.facture.lignes).toBeInstanceOf(Array);
    expect(res.body.facture.lignes.length).toBeGreaterThan(0);
  });

  test('GET /facture/:id/json rejette sans auth', async () => {
    const res = await request(app).get(`/pos/api/facture/${commandeId}/json`);
    expect(res.status).toBe(401);
  });

});

describe('DGI — Hash intégrité', () => {

  test('generateHash produit un hash SHA-256 valide', () => {
    const hash = facture.generateHash(
      { numero: 'CMD-20260727-0001', date_creation: '2026-07-27T12:00:00', total: 50 },
      '001234567000012'
    );
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('Hash change si le montant est modifié (intégrité)', () => {
    const h1 = facture.generateHash({ numero: 'CMD-001', date_creation: '2026-01-01', total: 100 }, 'ICE001');
    const h2 = facture.generateHash({ numero: 'CMD-001', date_creation: '2026-01-01', total: 101 }, 'ICE001');
    expect(h1).not.toBe(h2);
  });

  test('Hash change si le numéro est modifié', () => {
    const h1 = facture.generateHash({ numero: 'CMD-001', date_creation: '2026-01-01', total: 100 }, 'ICE001');
    const h2 = facture.generateHash({ numero: 'CMD-002', date_creation: '2026-01-01', total: 100 }, 'ICE001');
    expect(h1).not.toBe(h2);
  });

});

describe('DGI — Numérotation', () => {

  test('genererNumeroFacture transforme CMD en FA', () => {
    expect(facture.genererNumeroFacture('CMD-20260727-0001')).toBe('FA-20260727-0001');
  });

  test('genererNumeroAvoir transforme CMD en AV', () => {
    expect(facture.genererNumeroAvoir('CMD-20260727-0001')).toBe('AV-20260727-0001');
  });

});
