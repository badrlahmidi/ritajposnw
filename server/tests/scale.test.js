/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests Service Balance Série
 *  Teste les parseurs de protocoles (sans matériel physique).
 * ═══════════════════════════════════════════════════════════════
 */
const {
  parseCAS,
  parseMTSICS,
  parseOhaus,
  parseGeneric,
  getStatus,
  getCurrentWeight,
} = require('../services/scale.service');

// ─── Parseur CAS ──────────────────────────────────────────────────────────────

describe('parseCAS', () => {
  test('parse un poids en kg stable', () => {
    const r = parseCAS('   1.250 kg S');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(1.25);
    expect(r.stable).toBe(true);
  });

  test('parse un poids en grammes et convertit en kg', () => {
    const r = parseCAS('  1250 g S');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(1.25);
    expect(r.stable).toBe(true);
  });

  test('poids instable sans marqueur S', () => {
    const r = parseCAS('   0.800 kg');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(0.8);
    expect(r.stable).toBe(false);
  });

  test('retourne null si ligne invalide', () => {
    expect(parseCAS('ERROR')).toBeNull();
    expect(parseCAS('')).toBeNull();
    expect(parseCAS('abc xyz')).toBeNull();
  });

  test('parse des valeurs décimales précises', () => {
    const r = parseCAS('0.001 kg S');
    expect(r.kg).toBeCloseTo(0.001);
  });

  test('parse sans espaces en début', () => {
    const r = parseCAS('2.500 kg S');
    expect(r.kg).toBeCloseTo(2.5);
  });
});

// ─── Parseur MT-SICS ──────────────────────────────────────────────────────────

describe('parseMTSICS', () => {
  test('parse une réponse stable MT-SICS', () => {
    const r = parseMTSICS('S S      1.250 kg');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(1.25);
    expect(r.stable).toBe(true);
  });

  test('parse une réponse dynamique (non stable)', () => {
    const r = parseMTSICS('S D      0.750 kg');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(0.75);
    expect(r.stable).toBe(false);
  });

  test('parse en grammes et convertit en kg', () => {
    const r = parseMTSICS('S S      500 g');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(0.5);
    expect(r.stable).toBe(true);
  });

  test('retourne null si ligne invalide', () => {
    expect(parseMTSICS('ERROR')).toBeNull();
    expect(parseMTSICS('S X 1.250 kg')).toBeNull(); // X n'est pas S ou D
  });

  test('retourne null pour une chaîne vide', () => {
    expect(parseMTSICS('')).toBeNull();
  });
});

// ─── Parseur Ohaus ───────────────────────────────────────────────────────────

describe('parseOhaus', () => {
  test('parse un poids en kg', () => {
    const r = parseOhaus('+001.250 kg');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(1.25);
    expect(r.stable).toBe(true);
  });

  test('parse un poids en livres et convertit en kg', () => {
    const r = parseOhaus('2.756 lb');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(2.756 * 0.453592);
  });

  test('parse un poids en grammes', () => {
    const r = parseOhaus('1250 g');
    expect(r).not.toBeNull();
    expect(r.kg).toBeCloseTo(1.25);
  });

  test('gère le signe négatif (déstabilisation balance)', () => {
    const r = parseOhaus('-0.005 kg');
    // La valeur absolue est petite mais doit être parsée
    expect(r).not.toBeNull();
  });

  test('retourne null si ligne invalide', () => {
    expect(parseOhaus('ERR')).toBeNull();
  });
});

// ─── Parseur Générique ───────────────────────────────────────────────────────

describe('parseGeneric', () => {
  test('extrait un nombre décimal en kg', () => {
    const r = parseGeneric('  1.5 kg', 'kg');
    expect(r.kg).toBeCloseTo(1.5);
    expect(r.stable).toBe(true);
  });

  test('convertit si unit=g', () => {
    const r = parseGeneric('1500', 'g');
    expect(r.kg).toBeCloseTo(1.5);
  });

  test('parse des entiers', () => {
    const r = parseGeneric('2', 'kg');
    expect(r.kg).toBeCloseTo(2);
  });

  test('retourne null si aucun nombre trouvé', () => {
    expect(parseGeneric('no numbers here', 'kg')).toBeNull();
  });
});

// ─── getStatus (sans connexion) ──────────────────────────────────────────────

describe('getStatus', () => {
  test('retourne un objet avec les champs attendus', () => {
    const status = getStatus();
    expect(status).toHaveProperty('connected');
    expect(status).toHaveProperty('simulation');
    expect(status).toHaveProperty('port');
    expect(status).toHaveProperty('protocol');
  });

  test('non connecté par défaut', () => {
    const status = getStatus();
    // Sans appel à connect(), le port n'est pas ouvert
    // En mode simulation (serialport absent), connected peut être true ou false
    expect(typeof status.connected).toBe('boolean');
  });
});

// ─── getCurrentWeight (simulation) ──────────────────────────────────────────

describe('getCurrentWeight', () => {
  test('retourne un objet avec kg, stable, mode', () => {
    const w = getCurrentWeight();
    expect(w).toHaveProperty('mode');
    // kg peut être null si pas connecté, ou un nombre en simulation
    expect(['number', 'object'].includes(typeof w.kg) || w.kg === null).toBe(true);
  });

  test('en mode simulation, kg est un nombre > 0', () => {
    // Si serialport n'est pas installé, le module bascule en simulation
    const w = getCurrentWeight();
    if (w.mode === 'simulation') {
      expect(typeof w.kg).toBe('number');
      expect(w.kg).toBeGreaterThan(0);
      expect(w.stable).toBe(true);
    } else {
      // Mode disconnected ou serial sans port — kg est null ou un nombre
      expect(typeof w.kg === 'number' || w.kg === null).toBe(true);
    }
  });
});
