# RITAJ SMART POS — Spécifications Conformité DGI 2026

## 1. Synthèse des exigences facturation électronique

### 1.1 Contexte réglementaire

La Direction Générale des Impôts (DGI) du Maroc prépare la mise en place de la **facturation électronique obligatoire** dans le cadre de la Loi de Finances 2024-2026. Les principales exigences anticipées sont :

| Exigence | Description | Statut RITAJ |
|----------|-------------|-------------|
| **Numérotation séquentielle** | Numéros de facture uniques, séquentiels, sans rupture | ✅ Implémenté (CMD-YYYYMMDD-XXXX) |
| **Mentions obligatoires** | ICE, IF, RC, raison sociale, TVA détaillée | ⚠️ Partiel (ICE OK, IF/RC à ajouter) |
| **Conservation 10 ans** | Archivage des factures pendant 10 ans minimum | 🔧 À documenter |
| **Format structuré** | Export en format lisible machine (PDF/A, XML) | 🔧 À implémenter |
| **Intégrité des données** | Protection contre l'altération (hash, signature) | 🔧 À implémenter |
| **TVA détaillée** | Ventilation par taux (0%, 7%, 10%, 14%, 20%) | ✅ Implémenté |
| **Horodatage** | Date et heure précises de chaque transaction | ✅ Implémenté |

### 1.2 Taux TVA marocains applicables

| Taux | Application |
|------|------------|
| 0% | Produits exonérés (pain, farine, lait, etc.) |
| 7% | Eau, assainissement, produits pharmaceutiques |
| 10% | Restauration, hôtellerie, huiles alimentaires |
| 14% | Transport, énergie, beurre |
| 20% | Taux normal (majorité des produits et services) |

### 1.3 Mentions obligatoires sur facture (Article 145 du CGI)

Chaque facture émise doit contenir :

1. **Identité du vendeur** :
   - Raison sociale / Nom commercial
   - Adresse du siège social
   - ICE (Identifiant Commun de l'Entreprise) — 15 chiffres
   - IF (Identifiant Fiscal)
   - RC (Registre de Commerce)
   - Numéro de patente
   - CNSS (si applicable)

2. **Identité de l'acheteur** (si B2B) :
   - Raison sociale
   - ICE
   - Adresse

3. **Détails de la transaction** :
   - Numéro de facture (séquentiel, sans rupture)
   - Date d'émission
   - Désignation des biens/services
   - Quantité et prix unitaire HT
   - Taux de TVA par ligne
   - Montant TVA par ligne
   - Total HT
   - Total TVA (ventilé par taux)
   - Total TTC
   - Mode de paiement

---

## 2. Validation du format de numérotation

### 2.1 Format actuel

```
CMD-YYYYMMDD-XXXX
```

- **CMD** : Préfixe fixe pour commande
- **YYYYMMDD** : Date du jour (ex: 20260211)
- **XXXX** : Séquence journalière sur 4 chiffres (0001 à 9999)

### 2.2 Analyse de conformité

| Critère DGI | Analyse | Verdict |
|-------------|---------|---------|
| Unicité | Garanti par UNIQUE constraint + date + séquence | ✅ |
| Séquentialité | Séquence croissante par jour | ✅ |
| Sans rupture | Si annulation → le numéro est conservé (statut 'annulee') | ✅ |
| Lisibilité | Format clair et compréhensible | ✅ |
| Traçabilité | Date intégrée dans le numéro | ✅ |

### 2.3 Améliorations proposées

Pour distinguer les types de documents fiscaux, nous ajoutons un **préfixe de type** :

| Document | Format | Exemple |
|----------|--------|---------|
| Ticket de caisse | `TK-YYYYMMDD-XXXX` | TK-20260211-0001 |
| Facture | `FA-YYYYMMDD-XXXX` | FA-20260211-0001 |
| Avoir (annulation) | `AV-YYYYMMDD-XXXX` | AV-20260211-0001 |

> **Note** : Le format `CMD-YYYYMMDD-XXXX` existant est maintenu pour la rétrocompatibilité. Les nouveaux préfixes sont utilisés uniquement pour l'export PDF/XML.

### 2.4 Séquence globale vs journalière

La DGI exige une **numérotation séquentielle sans rupture**. Deux approches :

- **Séquence journalière** (actuel) : Repart de 0001 chaque jour → Conforme si combiné avec la date.
- **Séquence globale** : Compteur incrémental unique (FA-000001, FA-000002...) → Plus simple pour vérification.

**Décision** : Conserver la séquence journalière (déjà implémentée) car elle reste conforme lorsque combinée avec la date dans le numéro. Ajouter un compteur global optionnel pour les factures formelles.

---

## 3. Spécification export factures

### 3.1 Export PDF

**Objectif** : Générer des factures PDF conformes aux exigences DGI, depuis les données de commande existantes.

**Structure du document PDF** :

```
┌─────────────────────────────────────────────────────┐
│  LOGO         RAISON SOCIALE                        │
│               Adresse complète                      │
│               ICE: XXXXXXXXXXXXXXX                  │
│               IF: XXXXXXX | RC: XXXXXXX             │
│               Patente: XXXXXXX                      │
├─────────────────────────────────────────────────────┤
│  FACTURE N° FA-20260211-0001                        │
│  Date: 11/02/2026 14:35                             │
│  Client: Nom complet | ICE client (si B2B)          │
├─────────────────────────────────────────────────────┤
│  # │ Désignation │ Qté │ PU HT │ TVA% │ Total HT  │
│  1 │ Café        │  2  │ 8.33  │ 20%  │  16.67    │
│  2 │ Croissant   │  3  │ 9.09  │ 10%  │  27.27    │
├─────────────────────────────────────────────────────┤
│                    Sous-total HT :     43.94        │
│                    TVA 10% :            2.73        │
│                    TVA 20% :            3.33        │
│                    Total TVA :          6.06        │
│                    Total TTC :         50.00        │
├─────────────────────────────────────────────────────┤
│  Mode de paiement : Espèces                         │
│  Montant reçu : 50.00 | Monnaie : 0.00             │
├─────────────────────────────────────────────────────┤
│  Signature électronique / Hash intégrité            │
│  SHA-256: abcdef1234567890...                       │
└─────────────────────────────────────────────────────┘
```

### 3.2 Hash d'intégrité

Chaque facture générée inclut un **hash SHA-256** calculé sur :

```
HASH = SHA-256(numero_facture + date_creation + total_ttc + ice_vendeur)
```

Ce hash est :
- Stocké en base de données (nouvelle colonne `hash_integrite`)
- Imprimé sur le PDF
- Vérifiable pour détecter toute altération

### 3.3 Champs fiscaux additionnels

Nouveaux champs à ajouter au paramétrage :

| Champ | Table | Description |
|-------|-------|------------|
| `identifiant_fiscal` | parametres | IF du commerce |
| `registre_commerce` | parametres | RC du commerce |
| `numero_patente` | parametres | N° patente |
| `cnss` | parametres | N° CNSS (optionnel) |
| `raison_sociale` | parametres | Raison sociale officielle |

### 3.4 Export XML (préparation)

Le format XML sera défini par la DGI. En attendant les spécifications officielles, nous préparons une structure JSON intermédiaire :

```json
{
  "facture": {
    "numero": "FA-20260211-0001",
    "date": "2026-02-11T14:35:00",
    "vendeur": {
      "raison_sociale": "Mon Commerce SARL",
      "ice": "001234567000012",
      "identifiant_fiscal": "1234567",
      "registre_commerce": "RC12345"
    },
    "acheteur": {
      "nom": "Client XYZ",
      "ice": "009876543000034"
    },
    "lignes": [
      {
        "designation": "Café",
        "quantite": 2,
        "prix_unitaire_ht": 8.33,
        "taux_tva": 20,
        "montant_tva": 3.33,
        "total_ht": 16.67,
        "total_ttc": 20.00
      }
    ],
    "totaux": {
      "total_ht": 43.94,
      "ventilation_tva": [
        { "taux": 10, "base": 27.27, "montant": 2.73 },
        { "taux": 20, "base": 16.67, "montant": 3.33 }
      ],
      "total_tva": 6.06,
      "total_ttc": 50.00
    },
    "paiement": { "mode": "especes" },
    "hash_integrite": "sha256:abcdef..."
  }
}
```

---

## 4. Planning d'implémentation

| Étape | Livrable | Priorité |
|-------|----------|----------|
| 4.1 | Ajout champs fiscaux (IF, RC, patente) en base + paramètres | Haute |
| 4.2 | Hash d'intégrité sur chaque commande | Haute |
| 4.3 | Endpoint API `/api/facture/:id/pdf` | Haute |
| 4.4 | Endpoint API `/api/facture/:id/json` | Moyenne |
| 4.5 | Procédure de conservation 10 ans | Haute |
| 4.6 | UI : bouton "Exporter facture" dans l'historique | Moyenne |

---

*Document généré le 11/02/2026 — RITAJ SMART POS v4.1*
*Dernière mise à jour de la réglementation DGI consultée : Janvier 2026*
