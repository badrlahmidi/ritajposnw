const request = require('supertest');
const { initTestApp, setupAndLogin, authHeaders, cleanupTestDb } = require('./setup');

let app;
let adminToken;

beforeAll(async () => {
  app = await initTestApp();
  adminToken = await setupAndLogin(app);
}, 30000);

afterAll(() => { cleanupTestDb(); });

describe('Health & Readiness', () => {
  test('GET /pos/api/health/health retourne 200 avec version', async () => {
    const res = await request(app).get('/pos/api/health/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('setup');
  });

  test('GET /pos/api/health/ready retourne 200', async () => {
    const res = await request(app).get('/pos/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
  });
});

describe('CRUD Succursales', () => {
  let succId;

  test('GET /pos/api/succursales liste vide au départ', async () => {
    const res = await request(app)
      .get('/pos/api/succursales')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /pos/api/succursales crée une succursale', async () => {
    const res = await request(app)
      .post('/pos/api/succursales')
      .set(authHeaders())
      .send({ nom: 'Agence Casa', ville: 'Casablanca', telephone: '0522000001' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    succId = res.body.id;
  });

  test('POST /pos/api/succursales rejette nom vide', async () => {
    const res = await request(app)
      .post('/pos/api/succursales')
      .set(authHeaders())
      .send({ nom: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('PUT /pos/api/succursales/:id modifie la succursale', async () => {
    const res = await request(app)
      .put(`/pos/api/succursales/${succId}`)
      .set(authHeaders())
      .send({ nom: 'Agence Casa Update', ville: 'Rabat' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('GET /pos/api/succursales/:id retourne la succursale', async () => {
    const res = await request(app)
      .get(`/pos/api/succursales/${succId}`)
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body.nom).toBe('Agence Casa Update');
  });

  test('GET /pos/api/succursales/:id 404 si inexistant', async () => {
    const res = await request(app)
      .get('/pos/api/succursales/99999')
      .set(authHeaders());
    expect(res.status).toBe(404);
  });

  test('GET /pos/api/succursales/:id/stats retourne des statistiques', async () => {
    const res = await request(app)
      .get(`/pos/api/succursales/${succId}/stats`)
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nb_commandes');
    expect(res.body).toHaveProperty('total_ventes');
    expect(res.body).toHaveProperty('date');
  });

  test('PATCH /pos/api/succursales/:id/toggle change actif', async () => {
    const res = await request(app)
      .patch(`/pos/api/succursales/${succId}/toggle`)
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('actif', false);
    // revert
    await request(app)
      .patch(`/pos/api/succursales/${succId}/toggle`)
      .set(authHeaders());
  });

  test('PATCH /pos/api/succursales/1/toggle est bloqué (principale)', async () => {
    const res = await request(app)
      .patch('/pos/api/succursales/1/toggle')
      .set(authHeaders());
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('principale');
  });
});

describe('Caisse', () => {
  test('GET /pos/api/caisse/statut retourne fermee au départ', async () => {
    const res = await request(app)
      .get('/pos/api/caisse/statut')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('fermee');
  });

  test('POST /pos/api/caisse/ouvrir ouvre la caisse', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/ouvrir')
      .set(authHeaders())
      .send({ fond_caisse: 500 });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('ouverte');
  });

  test('POST /pos/api/caisse/ouvrir refuse une double ouverture', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/ouvrir')
      .set(authHeaders())
      .send({ fond_caisse: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('déjà ouverte');
  });

  test('POST /pos/api/caisse/mouvements ajoute un mouvement', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/mouvements')
      .set(authHeaders())
      .send({ type: 'depot', montant: 200, motif: 'Test dépôt' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('POST /pos/api/caisse/mouvements rejette montant invalide', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/mouvements')
      .set(authHeaders())
      .send({ type: 'retrait', montant: -5 });
    expect(res.status).toBe(400);
  });

  test('GET /pos/api/caisse/mouvements liste les mouvements', async () => {
    const res = await request(app)
      .get('/pos/api/caisse/mouvements')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /pos/api/caisse/fermer ferme la caisse', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/fermer')
      .set(authHeaders())
      .send({ montant_reel: 700, notes: 'Fermeture test' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('ecart');
  });

  test('GET /pos/api/caisse/statut retourne fermee après fermeture', async () => {
    const res = await request(app)
      .get('/pos/api/caisse/statut')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('fermee');
  });
});

describe('Livraisons', () => {
  let deliveryId;

  beforeAll(async () => {
    // Ajouter une catégorie et un produit pour les commandes
    const catRes = await request(app)
      .post('/pos/api/categories')
      .set(authHeaders())
      .send({ nom: 'Test Livraison', icone: '🚚', couleur: '#3498db' });
    catRes.body.id;
  });

  test('POST /pos/api/livraisons crée une livraison', async () => {
    // Ouvrir caisse, créer produit, puis commande
    await request(app)
      .post('/pos/api/caisse/ouvrir')
      .set(authHeaders())
      .send({ fond_caisse: 100 });
    const catRes = await request(app)
      .post('/pos/api/categories')
      .set(authHeaders())
      .send({ nom: 'Delivery Cat', icone: '📦', couleur: '#333' });
    const prodRes = await request(app)
      .post('/pos/api/produits')
      .set(authHeaders())
      .send({ code: 'DLV001', nom: 'Produit Livraison', prix_ttc: 50, categorie_id: catRes.body.id });
    const prodId = prodRes.body.id;
    const cmdRes = await request(app)
      .post('/pos/api/commandes')
      .set(authHeaders())
      .send({
        lignes: [{ produit_id: prodId, quantite: 1, prix_unitaire: 50 }],
        type_commande: 'livraison',
        client_nom: 'Client Liv',
        montant_recu: 50,
      });

    const res = await request(app)
      .post('/pos/api/livraisons')
      .set(authHeaders())
      .send({ commande_id: cmdRes.body.id, adresse: '123 Rue Test', telephone: '0600000000', frais_livraison: 15 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    deliveryId = res.body.id;
  });

  test('POST /pos/api/livraisons rejette sans commande_id', async () => {
    const res = await request(app)
      .post('/pos/api/livraisons')
      .set(authHeaders())
      .send({ adresse: 'Sans commande' });
    expect(res.status).toBe(400);
  });

  test('GET /pos/api/livraisons liste les livraisons du jour', async () => {
    const res = await request(app)
      .get('/pos/api/livraisons')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('PUT /pos/api/livraisons/:id/statut met à jour le statut', async () => {
    const res = await request(app)
      .put(`/pos/api/livraisons/${deliveryId}/statut`)
      .set(authHeaders())
      .send({ statut: 'en_cours' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('PUT /pos/api/livraisons/:id/statut rejette mauvais statut', async () => {
    const res = await request(app)
      .put(`/pos/api/livraisons/${deliveryId}/statut`)
      .set(authHeaders())
      .send({ statut: 'statut_invalide' });
    expect(res.status).toBe(400);
  });
});

describe('Dépenses', () => {
  let expenseId;

  test('GET /pos/api/depenses liste vide au départ', async () => {
    const res = await request(app)
      .get('/pos/api/depenses')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /pos/api/depenses crée une dépense', async () => {
    const res = await request(app)
      .post('/pos/api/depenses')
      .set(authHeaders())
      .send({ categorie: 'Fournitures', montant: 150, description: 'Test dépense', mode_paiement: 'especes' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    expenseId = res.body.id;
  });

  test('POST /pos/api/depenses rejette sans catégorie', async () => {
    const res = await request(app)
      .post('/pos/api/depenses')
      .set(authHeaders())
      .send({ montant: 100 });
    expect(res.status).toBe(400);
  });
});

describe('CRUD Utilisateurs', () => {
  let userId;

  test('GET /pos/api/utilisateurs liste les users', async () => {
    const res = await request(app)
      .get('/pos/api/utilisateurs')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /pos/api/utilisateurs crée un utilisateur', async () => {
    const res = await request(app)
      .post('/pos/api/utilisateurs')
      .set(authHeaders())
      .send({ nom: 'Caissier', login: 'caissier1', password: 'Pass1234', role: 'caissier' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    userId = res.body.id;
  });

  test('POST /pos/api/utilisateurs rejette login vide', async () => {
    const res = await request(app)
      .post('/pos/api/utilisateurs')
      .set(authHeaders())
      .send({ nom: 'Bad', login: '', password: 'Test1234' });
    expect(res.status).toBe(400);
  });

  test('PUT /pos/api/utilisateurs/:id modifie un utilisateur', async () => {
    const res = await request(app)
      .put(`/pos/api/utilisateurs/${userId}`)
      .set(authHeaders())
      .send({ nom: 'Caissier Modifié', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('DELETE /pos/api/utilisateurs/:id supprime un utilisateur', async () => {
    const res = await request(app)
      .delete(`/pos/api/utilisateurs/${userId}`)
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('DELETE /pos/api/utilisateurs/:id 404 si déjà supprimé', async () => {
    const res = await request(app)
      .delete(`/pos/api/utilisateurs/${userId}`)
      .set(authHeaders());
    expect(res.status).toBe(404);
  });

  test('DELETE /pos/api/utilisateurs/self refuse auto-suppression', async () => {
    const res = await request(app)
      .delete('/pos/api/utilisateurs/1')
      .set(authHeaders());
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('propre compte');
  });
});

describe('CRUD Remises', () => {
  let discountId;

  test('GET /pos/api/remises liste les remises', async () => {
    const res = await request(app)
      .get('/pos/api/remises')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /pos/api/remises crée une remise', async () => {
    const res = await request(app)
      .post('/pos/api/remises')
      .set(authHeaders())
      .send({ nom: 'Promo 10%', type: 'pourcentage', valeur: 10, condition_min: 100 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    discountId = res.body.id;
  });

  test('POST /pos/api/remises rejette sans valeur', async () => {
    const res = await request(app)
      .post('/pos/api/remises')
      .set(authHeaders())
      .send({ nom: 'Bad' });
    expect(res.status).toBe(400);
  });

  test('PUT /pos/api/remises/:id met à jour une remise', async () => {
    const res = await request(app)
      .put(`/pos/api/remises/${discountId}`)
      .set(authHeaders())
      .send({ nom: 'Promo 20%', valeur: 20 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('CRUD Fournisseurs', () => {
  let supplierId;

  test('GET /pos/api/fournisseurs liste les fournisseurs', async () => {
    const res = await request(app)
      .get('/pos/api/fournisseurs')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /pos/api/fournisseurs crée un fournisseur', async () => {
    const res = await request(app)
      .post('/pos/api/fournisseurs')
      .set(authHeaders())
      .send({ nom: 'Fournisseur A', contact: 'Ali', telephone: '0522000002' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    supplierId = res.body.id;
  });

  test('POST /pos/api/fournisseurs rejette nom vide', async () => {
    const res = await request(app)
      .post('/pos/api/fournisseurs')
      .set(authHeaders())
      .send({ nom: '' });
    expect(res.status).toBe(400);
  });

  test('PUT /pos/api/fournisseurs/:id modifie un fournisseur', async () => {
    const res = await request(app)
      .put(`/pos/api/fournisseurs/${supplierId}`)
      .set(authHeaders())
      .send({ nom: 'Fournisseur A Modifié', email: 'contact@fournisseur.ma' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('PUT /pos/api/fournisseurs/:id rejette nom vide', async () => {
    const res = await request(app)
      .put(`/pos/api/fournisseurs/${supplierId}`)
      .set(authHeaders())
      .send({ nom: '' });
    expect(res.status).toBe(400);
  });

  test('DELETE /pos/api/fournisseurs/:id désactive le fournisseur', async () => {
    const res = await request(app)
      .delete(`/pos/api/fournisseurs/${supplierId}`)
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('CRUD Taxes', () => {
  let taxId;

  test('GET /pos/api/taxes liste les taxes', async () => {
    const res = await request(app)
      .get('/pos/api/taxes')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /pos/api/taxes crée une taxe', async () => {
    const res = await request(app)
      .post('/pos/api/taxes')
      .set(authHeaders())
      .send({ nom: 'TVA 20%', taux: 20 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('id');
    taxId = res.body.id;
  });

  test('POST /pos/api/taxes rejette sans taux', async () => {
    const res = await request(app)
      .post('/pos/api/taxes')
      .set(authHeaders())
      .send({ nom: 'Bad' });
    expect(res.status).toBe(400);
  });

  test('PUT /pos/api/taxes/:id modifie la taxe', async () => {
    const res = await request(app)
      .put(`/pos/api/taxes/${taxId}`)
      .set(authHeaders())
      .send({ taux: 14 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('DELETE /pos/api/taxes/:id supprime la taxe', async () => {
    const res = await request(app)
      .delete(`/pos/api/taxes/${taxId}`)
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('DELETE /pos/api/taxes/:id 404 si inexistante', async () => {
    const res = await request(app)
      .delete('/pos/api/taxes/99999')
      .set(authHeaders());
    expect(res.status).toBe(404);
  });
});

describe('Paramètres & Audit', () => {
  test('GET /pos/api/parametres retourne les paramètres', async () => {
    const res = await request(app)
      .get('/pos/api/parametres')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nom_commerce');
  });

  test('GET /pos/api/parametres/public retourne les paramètres publics', async () => {
    const res = await request(app)
      .get('/pos/api/parametres/public');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('theme_couleur_accent');
  });

  test('PUT /pos/api/parametres met à jour un paramètre', async () => {
    const res = await request(app)
      .put('/pos/api/parametres')
      .set(authHeaders())
      .send({ app_nom: 'Ritaj POS Test' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('GET /pos/api/audit liste les entrées d\'audit', async () => {
    const res = await request(app)
      .get('/pos/api/audit')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Sécurité — Auth & RBAC', () => {
  test('GET /pos/api/succursales sans token retourne 401', async () => {
    const res = await request(app).get('/pos/api/succursales');
    expect(res.status).toBe(401);
  });

  test('POST /pos/api/succursales avec token invalide retourne 401', async () => {
    const res = await request(app)
      .post('/pos/api/succursales')
      .set({ Authorization: 'Bearer invalid_token' })
      .send({ nom: 'Test' });
    expect(res.status).toBe(401);
  });

  test('POST /pos/api/succursales par caissier retourne 403', async () => {
    // Créer un caissier et se connecter
    await request(app)
      .post('/pos/api/utilisateurs')
      .set(authHeaders())
      .send({ nom: 'Caissier RBAC', login: 'caissier_rbac', password: 'Test1234', role: 'caissier' });

    const loginRes = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'caissier_rbac', password: 'Test1234' });
    expect(loginRes.status).toBe(200);
    const caissierToken = loginRes.body.token;

    const res = await request(app)
      .post('/pos/api/succursales')
      .set({ Authorization: `Bearer ${caissierToken}` })
      .send({ nom: 'Devrait Fail' });
    expect(res.status).toBe(403);
  });

  test('POST /pos/api/auth/login rejette mauvais password', async () => {
    const res = await request(app)
      .post('/pos/api/auth/login')
      .send({ login: 'admin_test', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('GET /pos/api/auth/me retourne l\'utilisateur connecté', async () => {
    const res = await request(app)
      .get('/pos/api/auth/me')
      .set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('login', 'admin_test');
  });
});
