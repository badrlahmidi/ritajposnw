# Retail/Superette Features Sprint

## Objectifs
Implémenter les fonctionnalités spécifiques aux commerces de détail (supermarchés, épiceries) : gestion des codes-barres balance, étiquettes rayon, et gestion rapide du stock.

## Tâches

### 1. Codes-barres Balance (Variable Weight)
- [x] **Parser EAN-13** : Détecter les codes commençant par `20`-`29`.
    - Format standard: `PPIIIIIWCK` (Prefix, Item, Checksum, Weight/Price check).
    - Exemple: `2100050012503` -> Item `50`, Poids `1.250` kg.
- [x] **Logique Scan** : Modifier `POS.scanBarcode` pour parser le code avant d'appeler l'API.
- [x] **Gestion Panier** : Ajouter au panier avec la quantité décimale extraite (si poids) ou prix calculé.

### 2. Impression Étiquettes Rayon
- [x] **Bouton Impression** : Ajouter un bouton "🖨️ Étiquettes" dans l'onglet Produits (Admin).
- [x] **Sélection Multiple** : Permettre de cocher plusieurs produits pour impression en lot.
- [x] **Template Étiquette** : Créer un template PDF compact (4x2cm ou format A4 planche) avec :
    - Nom produit
    - Prix (Gros et lisible)
    - Code-barres
    - Unité (ex: "le kg" ou "l'unité")

### 3. Gestion Rapide Stock (Inventaire)
- [x] **Mode Inventaire** : Créer un écran "Inventaire Rapide" (ou modal).
- [x] **Scan & Update** : Scanner un produit -> Afficher stock actuel -> Saisir nouveau stock -> Valider.
- [x] **Historique** : Enregistrer ces ajustements comme "Inventaire" dans les mouvements de stock.

### 4. Rapports Ventes Détaillés
- [x] **Top Ventes** : Ajouter un rapport des produits les plus vendus (volume et valeur).
- [x] **Marges** : Afficher la marge brute (Prix Kente - Coût Revient) si le coût est renseigné.
