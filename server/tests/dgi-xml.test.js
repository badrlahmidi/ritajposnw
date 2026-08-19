const request = require('supertest');
const path = require('path');
const { buildInvoiceXML, validateFiscalFields, tvaBreakdown } = require('../utils/dgiXmlBuilder');
const { initTestApp, setupAndLogin, authHeaders, cleanupTestDb } = require('./setup');

let app;
let token;
let commandeId;
let numeroFacture;

async function setupOrder() {
  const h = authHeaders(token);
  await request(app).post('/pos/api/caisse/ouvrir').set(h).send({ fond_caisse: 500 });

  const paramsRes = await request(app).put('/pos/api/parametres').set(h).send({
    ice: '001234567000012',
    identifiant_fiscal: '1234567',
    registre_commerce: 'RC12345',
    numero_patente: 'PAT001',
    cnss: 'CNSS001',
    raison_sociale: 'RITAJ INFORMATIQUE SARL',
    adresse: '123 Rue de la Loi, Casablanca',
    telephone: '+212522000000'
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

beforeAll(async () => {
  app = await initTestApp();
  token = await setupAndLogin(app);
  await setupOrder();
});

afterAll(() => {
  cleanupTestDb();
});

describe('DGI — XML Builder unit', () => {

  test('tvaBreakdown regroupe correctement les TVA par taux', () => {
    const lignes = [
      { taux_tva: 20, sous_total_ht: 100, montant_tva: 20 },
      { taux_tva: 20, sous_total_ht: 50, montant_tva: 10 },
      { taux_tva: 10, sous_total_ht: 80, montant_tva: 8 },
      { taux_tva: 0, sous_total_ht: 30, montant_tva: 0 }
    ];
    const result = tvaBreakdown(lignes);
    expect(result).toHaveLength(3);
    const t20 = result.find(r => r.taux === 20);
    expect(t20.base).toBe(150);
    expect(t20.montant).toBe(30);
    const t10 = result.find(r => r.taux === 10);
    expect(t10.base).toBe(80);
    expect(t10.montant).toBe(8);
    const t0 = result.find(r => r.taux === 0);
    expect(t0.base).toBe(30);
  });

  test('buildInvoiceXML produit un XML valide avec root Invoice', () => {
    const lignes = [
      { nom_produit: 'Café', quantite: 2, prix_unitaire_ht: 8.33, sous_total_ht: 16.66, taux_tva: 20, montant_tva: 3.33, sous_total_ttc: 20 },
      { nom_produit: 'Croissant', quantite: 1, prix_unitaire_ht: 5.00, sous_total_ht: 5.00, taux_tva: 10, montant_tva: 0.50, sous_total_ttc: 5.50 }
    ];
    const commande = {
      numero: 'CMD-20260727-0001',
      date_creation: '2026-07-27T14:30:00',
      total: 25.50,
      total_tva: 3.83,
      remise_montant: 0,
      mode_paiement: 'especes',
      statut: 'validee',
      numero_facture: 'FA-20260727-0001',
      hash_integrite: 'abc123'
    };
    const params = {
      ice: '001234567000012',
      identifiant_fiscal: '1234567',
      registre_commerce: 'RC12345',
      numero_patente: 'PAT001',
      raison_sociale: 'RITAJ INFORMATIQUE SARL',
      adresse: '123 Rue Test, Casablanca',
      telephone: '+212522000000'
    };

    const xml = buildInvoiceXML({ commande, lignes, params, client: null });
    expect(xml).toContain('<Invoice');
    expect(xml).toContain('</Invoice>');
    expect(xml).toContain('FA-20260727-0001');
    expect(xml).toContain('001234567000012');
    expect(xml).toContain('RITAJ INFORMATIQUE SARL');
    expect(xml).toContain('TVA');
    expect(xml).toContain('MAD');
    expect(xml).toContain('abc123');
    expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
  });

  test('buildInvoiceXML inclut le client ICE en B2B', () => {
    const lignes = [
      { nom_produit: 'Service', quantite: 1, prix_unitaire_ht: 100, sous_total_ht: 100, taux_tva: 20, montant_tva: 20, sous_total_ttc: 120 }
    ];
    const commande = {
      numero: 'CMD-20260727-0002', date_creation: '2026-07-27T15:00:00',
      total: 120, total_tva: 20, remise_montant: 0, statut: 'validee',
      numero_facture: 'FA-20260727-0002', hash_integrite: 'hash001'
    };
    const params = { ice: '001234567000012', identifiant_fiscal: 'IF001', registre_commerce: 'RC001', numero_patente: 'PAT001', raison_sociale: 'SUPPLIER', adresse: 'Addr', telephone: 'Tel' };
    const client = { ice: '009876543210000', if_number: 'IF002', rc_number: 'RC002', raison_sociale: 'ACHETEUR SARL', adresse: 'Client addr', nom: 'Client' };

    const xml = buildInvoiceXML({ commande, lignes, params, client });
    expect(xml).toContain('009876543210000');
    expect(xml).toContain('IF002');
    expect(xml).toContain('RC002');
    expect(xml).toContain('ACHETEUR SARL');
  });

  test('buildInvoiceXML utilise ICE générique pour B2C', () => {
    const lignes = [
      { nom_produit: 'Pain', quantite: 3, prix_unitaire_ht: 2, sous_total_ht: 6, taux_tva: 10, montant_tva: 0.6, sous_total_ttc: 6.6 }
    ];
    const commande = {
      numero: 'CMD-20260727-0003', date_creation: '2026-07-27T16:00:00',
      total: 6.6, total_tva: 0.6, remise_montant: 0, statut: 'validee',
      numero_facture: 'FA-20260727-0003', hash_integrite: 'hash002'
    };
    const params = { ice: '001234567000012', identifiant_fiscal: 'IF001', registre_commerce: 'RC001', numero_patente: 'PAT001', raison_sociale: 'SUPPLIER', adresse: 'Addr', telephone: 'Tel' };
    const client = { nom: 'Client Comptoir', adresse: '' };

    const xml = buildInvoiceXML({ commande, lignes, params, client });
    expect(xml).toContain('999999999999999');
    expect(xml).toContain('Client Comptoir');
  });

});

describe('DGI — XML API', () => {

  test('GET /facture/:id/xml retourne un XML valide', async () => {
    const h = authHeaders(token);
    const res = await request(app).get(`/pos/api/facture/${commandeId}/xml`).set(h);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<Invoice');
    expect(res.text).toContain('</Invoice>');
    expect(res.text).toContain(numeroFacture);
    expect(res.text).toContain('001234567000012');
    expect(res.text).toContain('RITAJ INFORMATIQUE SARL');
    expect(res.text).toContain('sha256:');
  });

  test('GET /facture/:id/xml rejette sans auth', async () => {
    const res = await request(app).get(`/pos/api/facture/${commandeId}/xml`);
    expect(res.status).toBe(401);
  });

  test('GET /facture/:id/xml retourne 404 pour commande inexistante', async () => {
    const h = authHeaders(token);
    const res = await request(app).get('/pos/api/facture/99999/xml').set(h);
    expect(res.status).toBe(404);
  });

  test('GET /facture/:id/xml/validate valide une facture complète', async () => {
    const h = authHeaders(token);
    const res = await request(app).get(`/pos/api/facture/${commandeId}/xml/validate`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.errors).toEqual([]);
  });

  test('GET /facture/:id/xml/validate rejette sans auth', async () => {
    const res = await request(app).get(`/pos/api/facture/${commandeId}/xml/validate`);
    expect(res.status).toBe(401);
  });

});

describe('DGI — XML validateFiscalFields', () => {

  test('valide une facture avec tous les champs obligatoires', () => {
    const errors = validateFiscalFields({
      commande: { id: 1 },
      lignes: [{ id: 1 }],
      params: { ice: '001234567000012', identifiant_fiscal: 'IF001', registre_commerce: 'RC001', numero_patente: 'PAT001', raison_sociale: 'SARL', adresse: 'Addr' },
      client: null
    });
    expect(errors).toEqual([]);
  });

  test('signale les champs vendeur manquants', () => {
    const errors = validateFiscalFields({
      commande: { id: 1 },
      lignes: [{ id: 1 }],
      params: {},
      client: null
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors).toContain('ICE du vendeur manquant');
    expect(errors).toContain('Identifiant Fiscal (IF) du vendeur manquant');
  });

  test('signale commande introuvable', () => {
    const errors = validateFiscalFields({
      commande: null,
      lignes: [],
      params: { ice: '001', identifiant_fiscal: 'IF', registre_commerce: 'RC', numero_patente: 'PAT', raison_sociale: 'N', adresse: 'A' },
      client: null
    });
    expect(errors).toContain('Commande introuvable');
    expect(errors).toContain('Aucune ligne de facture');
  });

});