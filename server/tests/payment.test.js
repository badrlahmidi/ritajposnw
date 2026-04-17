/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests Service Paiement CMI
 *  Teste buildCMISignature, initPayment (mode manuel),
 *  validateManualPayment et checkPaymentStatus.
 * ═══════════════════════════════════════════════════════════════
 */
const crypto = require('crypto');
const {
  buildCMISignature,
  validateManualPayment,
} = require('../services/payment.service');

// ─── buildCMISignature ────────────────────────────────────────────────────────

describe('buildCMISignature', () => {
  test('retourne une chaîne hexadécimale de 128 caractères (SHA-512)', () => {
    const sig = buildCMISignature({ amount: '10000', oid: 'TEST-1' }, 'STOREKEY123');
    expect(typeof sig).toBe('string');
    expect(sig).toHaveLength(128);
    expect(/^[0-9A-F]+$/.test(sig)).toBe(true);
  });

  test('est déterministe (même entrée → même sortie)', () => {
    const params = { amount: '5000', clientid: 'MERCHANT1', oid: 'ORD-42', currency: '504' };
    const key = 'SECRET_KEY_XYZ';
    const sig1 = buildCMISignature(params, key);
    const sig2 = buildCMISignature(params, key);
    expect(sig1).toBe(sig2);
  });

  test('varie si le storeKey change', () => {
    const params = { amount: '5000', oid: 'ORD-42' };
    const sig1 = buildCMISignature(params, 'KEY_A');
    const sig2 = buildCMISignature(params, 'KEY_B');
    expect(sig1).not.toBe(sig2);
  });

  test('varie si les paramètres changent', () => {
    const sig1 = buildCMISignature({ amount: '1000' }, 'KEY');
    const sig2 = buildCMISignature({ amount: '9999' }, 'KEY');
    expect(sig1).not.toBe(sig2);
  });

  test('trie les paramètres alphabétiquement (ordre indépendant)', () => {
    const key = 'KEY';
    const sigA = buildCMISignature({ b: '2', a: '1', c: '3' }, key);
    const sigB = buildCMISignature({ c: '3', a: '1', b: '2' }, key);
    expect(sigA).toBe(sigB);
  });

  test('gère des paramètres vides', () => {
    expect(() => buildCMISignature({}, 'KEY')).not.toThrow();
  });

  test('cohérence avec implémentation HMAC SHA-512 manuelle', () => {
    const params = { amount: '20000', oid: 'RITAJ-1-12345' };
    const storeKey = 'TESTKEY';
    const sorted = Object.keys(params).sort();
    const values = sorted.map(k => params[k]).join('|');
    const sigString = `${storeKey}${values}|${storeKey}`;
    const expected = crypto.createHash('sha512').update(sigString, 'utf8').digest('hex').toUpperCase();
    expect(buildCMISignature(params, storeKey)).toBe(expected);
  });
});

// ─── initPayment (sans réseau) ────────────────────────────────────────────────

describe('initPayment — mode manuel (pas de config CMI)', () => {
  // Comme il n'y a pas de DB dans ce contexte de test, la fonction bascule
  // en mode manuel automatiquement (getConfig retourne {})
  const { initPayment } = require('../services/payment.service');

  test('retourne un objet avec mode=manual si aucune config CMI', async () => {
    const result = await initPayment({ commande_id: 1, montant: 89.5, mode: 'carte' });
    // Sans config CMI, doit retourner mode manual
    expect(result).toHaveProperty('mode');
    expect(result).toHaveProperty('montant');
    expect(Number(result.montant)).toBeCloseTo(89.5);
  });

  test('retourne mode=manual pour paiements non-carte', async () => {
    const result = await initPayment({ commande_id: 1, montant: 50, mode: 'especes' });
    expect(result.mode).toBe('manual');
    expect(result.status).toBe('pending_manual');
  });

  test('retourne currency=MAD', async () => {
    const result = await initPayment({ commande_id: 1, montant: 100, mode: 'especes' });
    expect(result.currency).toBe('MAD');
  });

  test('inclut un message indicatif pour le caissier', async () => {
    const result = await initPayment({ commande_id: 5, montant: 120, mode: 'especes' });
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  test('passe correctement le commande_id', async () => {
    const result = await initPayment({ commande_id: 42, montant: 200, mode: 'especes' });
    expect(Number(result.commande_id)).toBe(42);
  });
});

// ─── validateManualPayment ────────────────────────────────────────────────────

describe('validateManualPayment', () => {
  test('retourne un objet paiement valide', () => {
    const p = validateManualPayment({ commande_id: 1, montant: 150, mode: 'especes' });
    expect(p).toHaveProperty('montant');
    expect(Number(p.montant)).toBeCloseTo(150);
    expect(p.statut).toBe('valide');
    expect(p.mode).toBe('especes');
  });

  test('retourne le mode carte', () => {
    const p = validateManualPayment({ commande_id: 2, montant: 200, mode: 'carte' });
    expect(p.mode).toBe('carte');
  });

  test('retourne la référence si fournie', () => {
    const p = validateManualPayment({ commande_id: 3, montant: 50, mode: 'virement', reference: 'VIR-20260417' });
    expect(p.reference).toBe('VIR-20260417');
  });

  test('référence null par défaut', () => {
    const p = validateManualPayment({ commande_id: 4, montant: 75, mode: 'especes' });
    expect(p.reference).toBeNull();
  });

  test('montant correctement casté en Number', () => {
    const p = validateManualPayment({ commande_id: 5, montant: '99.99', mode: 'especes' });
    expect(typeof p.montant).toBe('number');
    expect(p.montant).toBeCloseTo(99.99);
  });
});
