# Plan d'amélioration UX - Phase 4A

## Objectifs
Implémenter les correctifs UX immédiats identifiés dans l'audit pour polir l'expérience utilisateur avant d'attaquer les grosses features métier.

## Tâches

### 1. Loading States (Spinners)
- [x] Ajouter un helper `btnLoading(btnElement, isLoading)` dans `pos.js` pour gérer l'état loading + disabled sur les boutons.
- [x] Ajouter un helper `viewLoading(containerId, isLoading)` pour afficher un spinner géant au chargement des vues (History, Clients, Stock, Stats).
- [x] Appliquer `btnLoading` sur : Login, Paiement, Save Client, Save Produit, Save User.
- [x] Appliquer `viewLoading` lors du switch de vues.

### 2. Responsive Tables
- [x] Créer une classe CSS `.table-responsive` avec `overflow-x: auto`.
- [x] Wrapper dynamiquement ou statiquement toutes les `<table>` de l'app dans une `div.table-responsive`.
- [x] Vérifier le rendu sur mobile (< 700px).

### 3. Validation Inline
- [x] Améliorer le CSS `.form-group.error` (bordure rouge + message texte).
- [x] Créer une fonction `validateField(inputElement, rules)` qui vérifie à la volée (`onblur` ou `oninput`).
- [x] Appliquer sur le formulaire Client (Nom, Tél) et Produit (Prix, Nom).

### 4. Dialogues de Confirmation
- [x] Remplacer les `window.confirm()` natifs par une modale custom stylisée (plus pro).
- [x] Créer une fonction `confirmDialog(title, message, callback)` returning Promise.
- [x] Appliquer sur : Suppression Panier, Suppression Produit (Admin), Déconnexion.

### 5. Guide Raccourcis Clavier
- [x] Ajouter un bouton "?" ou "Keyboard" dans le header ou footer.
- [x] Créer une modale simple listant :
    - F2: Recherche
    - F4: Nouvelle Vente
    - F5: Rafraîchir
    - F8: Caisse
    - Esc: Fermer modale

## Planning
- **Sprint 4A-1** : Loading states + Responsive tables (Jour 1) - **FAIT**
- **Sprint 4A-2** : Validation + Dialogues + Raccourcis (Jour 1) - **FAIT**
- **Sprint 4A-3** : Interface Tactile / Kiosque (Jour 2) - **FAIT**

### 6. Interface Tactile (Touch / Kiosque)
- [x] **Clavier Numérique Virtuel (Numpad)** : Ajouter un pavé numérique tactile qui s'ouvre pour les champs montant/quantité (Paiement, Remise, Stock).
    - Design style calculatrice/ATM.
    - Focus auto sur le champ input.
- [x] **Zones de touche agrandies** : Augmenter padding/taille des boutons (`.btn`, `.cat-btn`, `.nav-btn`) pour minimum 44x44px (standard touch).
- [x] **Formulaires Tactiles** : 
    - `input type="number"` / `tel` pour clavier numérique mobile natif.
    - Éviter les petits liens textuels, préférer les boutons.
    - Boutons `+/-` plus gros dans le panier.
