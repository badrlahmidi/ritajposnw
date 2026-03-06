const { generateHash, genererNumeroFacture, genererFactureJSON } = require('../facture');
const crypto = require('crypto');

describe('Module Facture', () => {
    const mockCommande = {
        numero: 'CMD-20260212-0001',
        date_creation: '2026-02-12T14:00:00.000Z',
        total: 100.00,
    };
    const mockParams = {
        ice: 'ICE123456789',
        raison_sociale: 'Mon Commerce'
    };

    test('genererNumeroFacture remplace CMD par FA', () => {
        const num = genererNumeroFacture('CMD-20260212-0001');
        expect(num).toBe('FA-20260212-0001');
    });

    test('generateHash génère un hash SHA-256 valide', () => {
        const hash = generateHash(mockCommande, mockParams.ice);
        const expectedData = `${mockCommande.numero}|${mockCommande.date_creation}|${mockCommande.total}|${mockParams.ice}`;
        const expectedHash = crypto.createHash('sha256').update(expectedData).digest('hex');
        expect(hash).toBe(expectedHash);
    });

    test('genererFactureJSON structure correctement les données', () => {
        const lignes = [
            {
                nom_produit: 'Café',
                quantite: 2,
                prix_unitaire_ht: 8.33,
                taux_tva: 20,
                montant_tva: 1.67,
                sous_total_ht: 16.66,
                sous_total_ttc: 20.00
            }
        ];

        // Enrichir la commande mockée
        const commandeComplete = {
            ...mockCommande,
            statut: 'payee',
            total_tva: 3.34,
            mode_paiement: 'especes',
            montant_recu: 100,
            monnaie_rendue: 0
        };

        const json = genererFactureJSON({
            commande: commandeComplete,
            lignes,
            params: mockParams
        });

        expect(json.facture).toBeDefined();
        expect(json.facture.numero).toBe('FA-20260212-0001');
        expect(json.facture.vendeur.ice).toBe('ICE123456789');
        expect(json.facture.totaux.total_ttc).toBe(100.00);
        expect(json.facture.lignes).toHaveLength(1);
        expect(json.facture.lignes[0].designation).toBe('Café');
        expect(json.facture.hash_integrite).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
});
