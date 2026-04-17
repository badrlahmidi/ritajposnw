/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests profils métier (Phase 1)
 *  Vérifie que seuls les profils Café & Restaurant sont exposés
 *  et que le setup rejette les profils hors whitelist.
 * ═══════════════════════════════════════════════════════════════
 */
const { getProfilesList, getProfile, ALLOWED_PROFILE_IDS } = require('../business-profiles');

// ─── Unit tests — business-profiles module (aucune DB requise) ────────────────

describe('business-profiles — whitelist', () => {
  test('ALLOWED_PROFILE_IDS ne contient pas boulangerie ni superette', () => {
    expect(ALLOWED_PROFILE_IDS).not.toContain('boulangerie');
    expect(ALLOWED_PROFILE_IDS).not.toContain('superette');
  });

  test('tous les ids de la whitelist ont une famille cafe ou restaurant', () => {
    const list = getProfilesList();
    const ids = list.map(p => p.id);
    expect(ids.sort()).toEqual([...ALLOWED_PROFILE_IDS].sort());
    for (const p of list) {
      expect(['cafe', 'restaurant']).toContain(p.famille);
    }
  });

  test('getProfile renvoie null pour boulangerie', () => {
    expect(getProfile('boulangerie')).toBeNull();
  });

  test('getProfile renvoie null pour superette', () => {
    expect(getProfile('superette')).toBeNull();
  });

  test('getProfile renvoie null pour retail', () => {
    expect(getProfile('retail')).toBeNull();
  });

  test('getProfile renvoie le profil cafe', () => {
    const p = getProfile('cafe');
    expect(p).not.toBeNull();
    expect(p.famille).toBe('cafe');
  });

  test('getProfile renvoie le profil restaurant', () => {
    const p = getProfile('restaurant');
    expect(p).not.toBeNull();
    expect(p.famille).toBe('restaurant');
  });

  test('getProfile renvoie le profil cafe_classique', () => {
    const p = getProfile('cafe_classique');
    expect(p).not.toBeNull();
    expect(p.famille).toBe('cafe');
  });

  test('getProfile renvoie le profil salon_the', () => {
    const p = getProfile('salon_the');
    expect(p).not.toBeNull();
    expect(p.famille).toBe('cafe');
  });

  test('getProfile renvoie le profil restaurant_service', () => {
    const p = getProfile('restaurant_service');
    expect(p).not.toBeNull();
    expect(p.famille).toBe('restaurant');
  });

  test('getProfile renvoie le profil fast_food', () => {
    const p = getProfile('fast_food');
    expect(p).not.toBeNull();
    expect(p.famille).toBe('restaurant');
  });

  test('chaque profil autorisé a les champs requis', () => {
    const list = getProfilesList();
    for (const p of list) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('famille');
      expect(p).toHaveProperty('nom');
      expect(p).toHaveProperty('icone');
      expect(p).toHaveProperty('features');
      expect(p).toHaveProperty('types_commande');
      expect(p.nb_categories).toBeGreaterThan(0);
      expect(p.nb_produits).toBeGreaterThan(0);
    }
  });

  test('getProfilesList retourne exactement 6 profils', () => {
    const list = getProfilesList();
    expect(list).toHaveLength(6);
  });

  test('getProfilesList ne retourne aucun profil hors whitelist', () => {
    const list = getProfilesList();
    const forbiddenIds = ['boulangerie', 'superette', 'retail', 'epicerie'];
    for (const p of list) {
      expect(forbiddenIds).not.toContain(p.id);
    }
  });

  test('chaque profil a des taxes marocaines (0,7,10,14,20)', () => {
    for (const id of ALLOWED_PROFILE_IDS) {
      const p = getProfile(id);
      const taux = p.taxes.map(t => t.taux);
      expect(taux).toContain(0);
      expect(taux).toContain(10);
      expect(taux).toContain(20);
    }
  });

  test('chaque profil restaurant a features.tables=true ou features.kds=true', () => {
    const restoProfils = getProfilesList().filter(p => p.famille === 'restaurant');
    expect(restoProfils.length).toBeGreaterThan(0);
    for (const p of restoProfils) {
      const hasTablesOrKDS = p.features.tables === true || p.features.kds === true;
      expect(hasTablesOrKDS).toBe(true);
    }
  });
});

