/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Tests Service Impression ESC/POS
 *  Teste la génération des buffers sans matériel physique.
 * ═══════════════════════════════════════════════════════════════
 */
const {
  buildTicketBuffer,
  buildKitchenBuffer,
  sendTCP,
} = require('../services/printing.service');

// ─── buildTicketBuffer ────────────────────────────────────────────────────────

describe('buildTicketBuffer', () => {
  const baseCommande = {
    id: 1,
    numero: 'CMD-2026-0001',
    table_numero: '3',
    serveur_nom: 'Mehdi',
    nb_couverts: 2,
    total: 89.50,
    sous_total: 89.50,
    total_tva: 7.45,
    remise_montant: 0,
    monnaie_rendue: 10.50,
    lignes: [
      { quantite: 2, produit_nom: 'Café allongé', total_ligne: 20, notes_cuisine: null },
      { quantite: 1, produit_nom: 'Croque-monsieur', total_ligne: 35, notes_cuisine: 'Sans tomate' },
      { quantite: 1, produit_nom: 'Jus orange', total_ligne: 34.50, notes_cuisine: null },
    ],
    paiements: [
      { mode: 'especes', montant: 100 },
    ],
  };

  test('retourne un Buffer non vide', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(50);
  });

  test('contient ESC @ (init) en début', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    // ESC = 0x1b, @ = 0x40
    expect(buf[0]).toBe(0x1b);
    expect(buf[1]).toBe(0x40);
  });

  test('contient le numéro de commande', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    const text = buf.toString('latin1');
    expect(text).toContain('CMD-2026-0001');
  });

  test('contient le numéro de table', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    const text = buf.toString('latin1');
    expect(text).toContain('3');
  });

  test('contient les noms de produits (translit. accents)', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    const text = buf.toString('latin1');
    // "Café" → "Cafe" en translittération
    expect(text).toContain('Cafe');
    expect(text).toContain('Croque-monsieur');
  });

  test('contient le total', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    const text = buf.toString('latin1');
    expect(text).toContain('89.50');
  });

  test('inclut commande de coupe papier si cutPaper=true', () => {
    const buf = buildTicketBuffer(baseCommande, {}, { cutPaper: true });
    // GS V = coupe papier : 0x1d 0x56
    const arr = Array.from(buf);
    const hasGSV = arr.some((b, i) => b === 0x1d && arr[i + 1] === 0x56);
    expect(hasGSV).toBe(true);
  });

  test('n\'inclut pas coupe papier si cutPaper=false', () => {
    const buf = buildTicketBuffer(baseCommande, {}, { cutPaper: false });
    const arr = Array.from(buf);
    const hasGSV = arr.some((b, i) => b === 0x1d && arr[i + 1] === 0x56);
    expect(hasGSV).toBe(false);
  });

  test('inclut commande tiroir si openDrawer=true', () => {
    const buf = buildTicketBuffer(baseCommande, {}, { openDrawer: true });
    // ESC p = 0x1b 0x70
    const arr = Array.from(buf);
    const hasDrawer = arr.some((b, i) => b === 0x1b && arr[i + 1] === 0x70);
    expect(hasDrawer).toBe(true);
  });

  test('n\'inclut pas tiroir si openDrawer=false', () => {
    const buf = buildTicketBuffer(baseCommande, {}, { openDrawer: false });
    const arr = Array.from(buf);
    const hasDrawer = arr.some((b, i) => b === 0x1b && arr[i + 1] === 0x70);
    expect(hasDrawer).toBe(false);
  });

  test('inclut le nom du commerce', () => {
    const buf = buildTicketBuffer(baseCommande, { nom: 'Café Le Palais', adresse: '12 rue Hassan II' }, {});
    const text = buf.toString('latin1');
    expect(text).toContain('Le Palais'); // "Café" → "Cafe"
    expect(text).toContain('Hassan II');
  });

  test('inclut les notes cuisine', () => {
    const buf = buildTicketBuffer(baseCommande, {}, {});
    const text = buf.toString('latin1');
    expect(text).toContain('Sans tomate');
  });

  test('gère une commande sans lignes', () => {
    const cmd = { ...baseCommande, lignes: [] };
    expect(() => buildTicketBuffer(cmd, {}, {})).not.toThrow();
  });

  test('gère un total nul', () => {
    const cmd = { ...baseCommande, total: 0, lignes: [] };
    const buf = buildTicketBuffer(cmd, {}, {});
    expect(buf.toString('latin1')).toContain('0.00');
  });
});

// ─── buildKitchenBuffer ───────────────────────────────────────────────────────

describe('buildKitchenBuffer', () => {
  const baseCommande = {
    id: 2,
    numero: 'CMD-2026-0002',
    table_numero: '7',
    nb_couverts: 4,
    lignes: [
      { quantite: 2, produit_nom: 'Steak frites', cours: 'plat', notes_cuisine: null, options_json: null },
      { quantite: 1, produit_nom: 'Salade niçoise', cours: 'entree', notes_cuisine: 'Sans anchois', options_json: '["sans oignons"]' },
      { quantite: 2, produit_nom: 'Crème brûlée', cours: 'dessert', notes_cuisine: null, options_json: null },
    ],
  };

  test('retourne un Buffer non vide', () => {
    const buf = buildKitchenBuffer(baseCommande, {});
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(20);
  });

  test('contient le numéro de table', () => {
    const buf = buildKitchenBuffer(baseCommande, {});
    expect(buf.toString('latin1')).toContain('7');
  });

  test('contient tous les plats quand cours=null', () => {
    const buf = buildKitchenBuffer(baseCommande, { cours: null });
    const text = buf.toString('latin1');
    expect(text).toContain('Steak frites');
    expect(text).toContain('Salade');
    expect(text).toContain('Creme brulee');
  });

  test('filtre correctement par cours=entree', () => {
    const buf = buildKitchenBuffer(baseCommande, { cours: 'entree' });
    const text = buf.toString('latin1');
    expect(text).toContain('Salade');
    expect(text).not.toContain('Steak');
    expect(text).not.toContain('brulee');
  });

  test('filtre correctement par cours=plat', () => {
    const buf = buildKitchenBuffer(baseCommande, { cours: 'plat' });
    const text = buf.toString('latin1');
    expect(text).toContain('Steak');
    expect(text).not.toContain('Salade');
  });

  test('inclut les notes cuisine', () => {
    const buf = buildKitchenBuffer(baseCommande, { cours: 'entree' });
    expect(buf.toString('latin1')).toContain('Sans anchois');
  });

  test('inclut les options JSON', () => {
    const buf = buildKitchenBuffer(baseCommande, { cours: 'entree' });
    expect(buf.toString('latin1')).toContain('sans oignons');
  });

  test('inclut une coupe papier à la fin', () => {
    const buf = buildKitchenBuffer(baseCommande, {});
    const arr = Array.from(buf);
    const hasGSV = arr.some((b, i) => b === 0x1d && arr[i + 1] === 0x56);
    expect(hasGSV).toBe(true);
  });

  test('libellé cuisine dans le header', () => {
    const buf = buildKitchenBuffer(baseCommande, { cours: 'plat' });
    expect(buf.toString('latin1')).toContain('PLAT');
  });
});

// ─── sendTCP (mock net) ───────────────────────────────────────────────────────

describe('sendTCP', () => {
  const net = require('net');

  test('rejette si connexion impossible (port fermé)', async () => {
    await expect(sendTCP('127.0.0.1', 19999, Buffer.from('test'), 500))
      .rejects.toThrow();
  });

  test('résout si le serveur accepte les données', async () => {
    // Créer un serveur TCP local de test
    const server = net.createServer(socket => {
      socket.on('data', () => { socket.end(); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      await expect(sendTCP('127.0.0.1', port, Buffer.from('test'), 2000))
        .resolves.toBeUndefined();
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }, 5000);
});
