# RITAJ SMART POS — Audit UI/UX & Fiches d'Amélioration par Métier

**Date :** 11/02/2026  
**Version :** 4.1.0  
**Cible :** Marché marocain (PME/TPE)

---

## TABLE DES MATIÈRES

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Inventaire complet de l'application](#2-inventaire-complet)
3. [Audit UI/UX global](#3-audit-uiux-global)
4. [Matrice fonctionnelle — Implémenté vs Manquant](#4-matrice-fonctionnelle)
5. [Fiche métier — CAFÉ](#5-fiche-métier--café)
6. [Fiche métier — RESTAURANT](#6-fiche-métier--restaurant)
7. [Fiche métier — BOULANGERIE / PÂTISSERIE](#7-fiche-métier--boulangeriepâtisserie)
8. [Fiche métier — BOUTIQUE / SUPERETTE](#8-fiche-métier--boutiquesuperette)
9. [Fonctionnalités transversales manquantes](#9-fonctionnalités-transversales-manquantes)
10. [Plan d'amélioration prioritisé](#10-plan-damélioration-prioritisé)

---

## 1. Résumé exécutif

### Forces actuelles
- **Architecture solide** : Backend Express.js + SQLite avec JWT, validateurs, logs structurés
- **4 profils métier** : Café (47 produits), Restaurant (50), Boulangerie (50), Superette (50)
- **TVA conforme** : 5 taux marocains (0%, 7%, 10%, 14%, 20%)
- **Conformité DGI** : Hash d'intégrité, export PDF/JSON, conservation 10 ans
- **49/49 tests** passent, couverture des routes critiques
- **Dashboard hybride** : Navigation moderne avec raccourcis + sidebar

### Faiblesses identifiées
- **4 features déclarées mais non implémentées** : Gestion tables, KDS, Scan code-barres, Livraison
- **UI/UX perfectible** : Pas de loading states, accessibilité incomplète, responsive limité
- **Pas de mode hors-ligne** : Dépendance réseau pour une app desktop
- **Pas d'import/export données** : Migration vers/depuis autres systèmes impossible
- **Rapports limités** : Pas d'export Excel, pas de graphiques avancés

### Score global

| Domaine | Score | Commentaire |
|---------|-------|-------------|
| Backend / API | ★★★★☆ (8/10) | Solide, bien structuré, validé par tests |
| Base de données | ★★★★☆ (8/10) | Schéma complet, migrations gérées |
| UI/UX Design | ★★★☆☆ (6/10) | Fonctionnel mais basique, manque de polish |
| Responsive | ★★☆☆☆ (5/10) | Breakpoints basiques, tables non responsive |
| Accessibilité | ★★☆☆☆ (4/10) | Manque ARIA, navigation clavier limitée |
| Features métier | ★★★☆☆ (6/10) | Core OK, features spécialisées manquantes |
| Performance | ★★★★☆ (7/10) | SQLite rapide, pas de lazy loading |
| Sécurité | ★★★★☆ (8/10) | JWT, bcrypt, rate limiting, validation |
| Documentation | ★★★★☆ (8/10) | Manuel, specs DGI, procédure backup |

---

## 2. Inventaire complet

### 2.1 Écrans de l'application (9)

| # | Écran | ID HTML | État |
|---|-------|---------|------|
| 1 | Setup Wizard (3 étapes) | `#setupWizard` | ✅ Complet |
| 2 | Login | `#loginScreen` | ✅ Complet |
| 3 | Dashboard (accueil) | `#dashboardScreen` | ✅ Complet |
| 4 | Caisse (POS) | `#view-pos` | ✅ Complet |
| 5 | Historique commandes | `#view-history` | ✅ Complet |
| 6 | Clients | `#view-clients` | ✅ Complet |
| 7 | Stock | `#view-stock` | ✅ Complet |
| 8 | Statistiques | `#view-stats` | ✅ Complet |
| 9 | Administration (6 onglets) | `#view-admin` | ✅ Complet |

### 2.2 Modaux (9)

| # | Modal | Fonction |
|---|-------|----------|
| 1 | `#successModal` | Confirmation de vente + impression |
| 2 | `#caisseModal` | Ouverture / fermeture caisse |
| 3 | `#clientSearchModal` | Recherche client pour commande |
| 4 | `#clientFormModal` | Création / modification client |
| 5 | `#discountModal` | Application de remise |
| 6 | `#produitFormModal` | Création / modification produit |
| 7 | `#userFormModal` | Création / modification utilisateur |
| 8 | `#orderDetailModal` | Détail commande (ticket preview) |
| 9 | `#stockAdjustModal` | Ajustement manuel du stock |

### 2.3 Routes API (40)

| Domaine | Routes | Auth | Validation |
|---------|--------|------|------------|
| Setup | 3 | Non | Oui |
| Auth | 2 | Partiel | Oui |
| Utilisateurs | 3 | Admin | Oui |
| Catégories | 4 | Admin/Manager | Oui |
| Taxes | 2 | Admin | Partiel |
| Produits | 3 | Admin/Manager | Oui |
| Commandes | 4 | Auth | Oui |
| Factures DGI | 2 | Auth | Non |
| Caisse | 3 | Auth | Oui |
| Clients | 3 | Auth | Oui |
| Stock | 4 | Auth/Admin | Partiel |
| Remises | 3 | Admin/Manager | Oui |
| Dépenses | 2 | Admin/Manager | Oui |
| Fournisseurs | 2 | Auth | Oui |
| Statistiques | 2 | Auth/Admin | Partiel |
| Paramètres | 2 | Auth/Admin | Non |
| Backup | 4 | Admin | Partiel |
| Audit | 1 | Admin | Non |

### 2.4 Tables de base de données (16)

| Table | Colonnes | Relations | État |
|-------|----------|-----------|------|
| `succursales` | 9 | — | ⚠️ Pas de CRUD API |
| `utilisateurs` | 12 | → succursales | ✅ |
| `categories` | 6 | — | ✅ |
| `taxes` | 5 | — | ✅ |
| `produits` | 12 | → categories, taxes | ✅ |
| `clients` | 12 | — | ✅ |
| `remises` | 14 | → categories, produits | ✅ |
| `commandes` | 21 | → clients, utilisateurs, succursales | ✅ |
| `commande_lignes` | 13 | → commandes, produits | ✅ |
| `sessions_caisse` | 14 | → utilisateurs, succursales | ✅ |
| `stock` | 7 | → produits, succursales | ✅ |
| `mouvements_stock` | 11 | → produits, utilisateurs | ✅ |
| `fournisseurs` | 9 | — | ✅ |
| `depenses` | 10 | → fournisseurs, utilisateurs | ✅ |
| `audit_log` | 9 | — | ✅ |
| `parametres` | 3 | — | ✅ |

---

## 3. Audit UI/UX global

### 3.1 Design System

| Élément | État | Note |
|---------|------|------|
| Variables CSS | ✅ 30+ variables | Complet (couleurs, ombres, radius, transitions) |
| Thème clair | ✅ | Bien conçu |
| Thème sombre | ✅ | Fonctionnel |
| Thème dynamique métier | ✅ | Couleurs s'adaptent au profil |
| Typographie | ⚠️ | System fonts uniquement, pas de hiérarchie forte |
| Spacing | ⚠️ | Mixte (px fixes, pas de système scale) |
| Icônes | ⚠️ | Emojis uniquement (inconsistant cross-platform) |

### 3.2 Composants UI

| Composant | Variantes | État |
|-----------|-----------|------|
| Boutons | 8 (primary, success, danger, warning, info, secondary, outline, ghost) + 3 tailles | ✅ |
| Badges | 5 variantes couleur | ✅ |
| Cards | Dashboard, stats, profile | ✅ |
| Tables | Données avec tri visuel | ⚠️ Pas de tri interactif, pas responsive |
| Modaux | 9 modaux | ⚠️ Pas de `aria-modal` |
| Formulaires | Labels, inputs, selects, textareas | ⚠️ Pas de validation inline |
| Toasts | Notifications | ✅ |
| Animations | fadeIn, scaleIn, slideIn, slideUp | ✅ |

### 3.3 Problèmes UX critiques

| # | Problème | Impact | Priorité |
|---|----------|--------|----------|
| 1 | **Pas de loading states** | L'utilisateur ne sait pas si une action est en cours | HAUTE |
| 2 | **Tables non responsive** | Inutilisable sur tablette/mobile | HAUTE |
| 3 | **Pas de validation inline** | L'utilisateur doit soumettre pour voir les erreurs | MOYENNE |
| 4 | **Pas de confirmation avant actions destructives** | Risque de suppression accidentelle | HAUTE |
| 5 | **Empty states basiques** | Texte seul, pas de CTA ni illustration | BASSE |
| 6 | **Emojis inconsistants** | Rendu différent selon OS/navigateur | MOYENNE |
| 7 | **Pas de breadcrumbs** | Navigation floue dans les sous-sections | BASSE |
| 8 | **Pas de recherche globale** | Faut naviguer manuellement entre vues | MOYENNE |
| 9 | **Pas d'undo/redo** | Erreurs de saisie non récupérables | BASSE |
| 10 | **Pas de raccourcis visibles** | F2, F4, F5, F8, Esc non documentés dans l'UI | BASSE |

### 3.4 Responsive Design

| Breakpoint | État | Problèmes |
|------------|------|-----------|
| > 1200px (Desktop) | ✅ OK | — |
| 900–1200px (Laptop) | ✅ OK | Cart un peu étroite |
| 700–900px (Tablette) | ⚠️ | Layout POS empilé, tables overflow |
| < 700px (Mobile) | ❌ | Quasi inutilisable pour POS, tables cassées |

### 3.5 Accessibilité (WCAG 2.1)

| Critère | État |
|---------|------|
| Labels de formulaires | ✅ |
| `aria-label` sur cartes produits | ✅ |
| Raccourcis clavier | ✅ (F2, F4, F5, F8, Esc) |
| `aria-live` pour zones dynamiques | ❌ |
| `aria-modal` sur modaux | ❌ |
| Skip links | ❌ |
| Focus visible sur tous éléments | ❌ |
| Contraste couleurs vérifié | ❌ |
| Navigation clavier dans grilles produits | ❌ |
| Annonces screen reader pour erreurs | ❌ |

---

## 4. Matrice fonctionnelle — Implémenté vs Manquant

### Légende
- ✅ = Totalement implémenté (backend + frontend)
- ⚠️ = Partiellement implémenté (données en BDD mais pas de UI/API complète)
- ❌ = Non implémenté (déclaré comme feature mais absent du code)
- 🔲 = Non applicable pour ce métier

| Fonctionnalité | Café | Restaurant | Boulangerie | Superette |
|----------------|------|------------|-------------|-----------|
| **CORE POS** | | | | |
| Prise de commande | ✅ | ✅ | ✅ | ✅ |
| Calcul TVA multi-taux | ✅ | ✅ | ✅ | ✅ |
| Paiement espèces/carte | ✅ | ✅ | ✅ | ✅ |
| Impression ticket | ✅ | ✅ | ✅ | ✅ |
| Export facture PDF (DGI) | ✅ | ✅ | ✅ | ✅ |
| Annulation commande | ✅ | ✅ | ✅ | ✅ |
| **GESTION** | | | | |
| Produits CRUD | ✅ | ✅ | ✅ | ✅ |
| Catégories CRUD | ✅ | ✅ | ✅ | ✅ |
| Stock + alertes | ✅ | ✅ | ✅ | ✅ |
| Mouvements stock | ✅ | ✅ | ✅ | ✅ |
| Clients + fidélité | ✅ | ✅ | ✅ | ✅ |
| Remises/Promotions | ✅ | ✅ | ✅ | ✅ |
| Dépenses | ✅ | ✅ | ✅ | ✅ |
| Fournisseurs | ✅ | ✅ | ✅ | ✅ |
| Sessions caisse | ✅ | ✅ | ✅ | ✅ |
| Statistiques | ✅ | ✅ | ✅ | ✅ |
| **SPÉCIFIQUE MÉTIER** | | | | |
| Gestion des tables | 🔲 | ❌ | 🔲 | 🔲 |
| KDS (Kitchen Display) | 🔲 | ❌ | 🔲 | 🔲 |
| Scan code-barres | 🔲 | 🔲 | ❌ | ❌ |
| Livraison + suivi | 🔲 | ❌ | 🔲 | ❌ |
| Pourboire | ⚠️ | ⚠️ | 🔲 | 🔲 |
| **TYPES COMMANDE** | | | | |
| Sur place | ✅ | ✅ | ✅ | 🔲 |
| Emporter | ✅ | ✅ | ✅ | ✅ |
| Livraison | 🔲 | ⚠️ | 🔲 | ⚠️ |
| **ADMIN** | | | | |
| Multi-succursales | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Utilisateurs + rôles | ✅ | ✅ | ✅ | ✅ |
| Paramètres commerce | ✅ | ✅ | ✅ | ✅ |
| Audit log | ✅ | ✅ | ✅ | ✅ |
| Backup + archivage | ✅ | ✅ | ✅ | ✅ |

---

## 5. Fiche métier — CAFÉ ☕

### Profil actuel
- **7 catégories** : Boissons Chaudes, Froides, Jus, Pâtisseries, Viennoiseries, Snacks, Glaces
- **47 produits** pré-configurés
- **TVA** : 10% par défaut (restauration)
- **Features** : Emporter, Sur place, Fidélité, Pourboire

### Ce qui fonctionne bien
- ✅ Catalogue riche et adapté (espresso, noss-noss, thé à la menthe...)
- ✅ Prise de commande rapide (grille produits + panier)
- ✅ Fidélité clients (points par DH dépensé)
- ✅ TVA restauration 10% appliquée correctement
- ✅ Session caisse avec ouverture/fermeture

### Fonctionnalités manquantes

| # | Fonctionnalité | Importance | Description |
|---|----------------|------------|-------------|
| C1 | **Gestion des pourboires** | HAUTE | Feature déclarée mais non implémentée. Besoin : champ pourboire dans la commande, répartition caissier, rapport journalier des pourboires |
| C2 | **Commande rapide (quick order)** | HAUTE | Un café = 1 clic. Boutons favoris/raccourcis pour les produits les plus vendus (Noss-Noss, Thé menthe...) |
| C3 | **Programme happy hour** | MOYENNE | Prix différents selon l'heure (ex: -20% sur boissons froides 14h-16h). Les remises conditionnelles existent mais pas l'automatisation |
| C4 | **Compteur de portions** | MOYENNE | Suivi du nombre de portions par bouteille/paquet (ex: 1 sachet de thé = 30 portions, café en grains = X espressos) |
| C5 | **Mode kiosque** | BASSE | Interface simplifiée pour borne de commande client (auto-service) |
| C6 | **Intégration balance connectée** | BASSE | Pour peser les viennoiseries/pâtisseries vendues au poids |

### Améliorations UX spécifiques
- Afficher les produits les plus vendus en premier
- Ajouter des variantes produit (taille S/M/L pour boissons)
- Permettre les suppléments (lait végétal, sirop, crème chantilly)
- Compteur de commandes en temps réel dans la barre du haut

---

## 6. Fiche métier — RESTAURANT 🍽️

### Profil actuel
- **9 catégories** : Entrées, Plats, Grillades, Tajines, Poissons, Accompagnements, Desserts, Boissons, Boissons Chaudes
- **50 produits** pré-configurés (cuisine marocaine + internationale)
- **TVA** : 10% par défaut (restauration)
- **Features déclarées** : Tables, KDS, Livraison, Emporter, Sur place, Fidélité, Pourboire

### Ce qui fonctionne bien
- ✅ Catalogue riche et adapté (tajines, couscous, grillades...)
- ✅ 3 types de commande (sur place, emporter, livraison)
- ✅ TVA détaillée par article sur les tickets
- ✅ Gestion complète du stock avec alertes

### Fonctionnalités manquantes — CRITIQUES

| # | Fonctionnalité | Importance | Description |
|---|----------------|------------|-------------|
| R1 | **Gestion des tables** | CRITIQUE | Feature flag activé mais ZÉRO code. Besoin : plan de salle, statut tables (libre/occupée/réservée/en_attente_paiement), attribution table à commande, regroupement commandes par table, transfert de table |
| R2 | **KDS (Kitchen Display System)** | CRITIQUE | Feature flag activé mais ZÉRO code. Besoin : écran cuisine séparé, file d'attente des commandes, statut préparation (reçue → en_préparation → prête → servie), timer par commande, alerte retard |
| R3 | **Gestion pourboires** | HAUTE | Même besoin que le Café — champ pourboire, répartition, reporting |
| R4 | **Split/merge commandes** | HAUTE | Diviser une commande par convive (partage l'addition) ou fusionner deux commandes sur la même table |
| R5 | **Gestion livraison** | HAUTE | Feature flag activé. Besoin : adresse de livraison, zone de livraison, frais de livraison, assignation livreur, statut suivi (préparation → en route → livrée) |
| R6 | **Réservations** | MOYENNE | Système de réservation de tables avec calendrier, confirmation, rappel |
| R7 | **Modificateurs/Suppléments** | HAUTE | "Sans oignon", "Extra fromage", "Bien cuit" — modificateurs par produit avec ajustement prix |
| R8 | **Menu du jour / Formules** | MOYENNE | Entrée + Plat + Dessert = prix fixe, avec choix parmi une sélection |
| R9 | **Impression cuisine** | HAUTE | Impression automatique en cuisine quand commande validée (différent du ticket client) |
| R10 | **Gestion des courses** | MOYENNE | Lien entre recettes et ingrédients, déduction stock par ingrédient |

### Améliorations UX spécifiques
- Plan de salle visuel (drag & drop pour disposition des tables)
- Vue temps réel des tables occupées avec timer
- Code couleur des commandes par statut de préparation
- Notification sonore quand commande prête en cuisine
- Vue split-screen : salle + cuisine

---

## 7. Fiche métier — BOULANGERIE / PÂTISSERIE 🍞

### Profil actuel
- **8 catégories** : Pains, Viennoiseries, Pâtisseries, Sandwichs, Boissons Chaudes, Froides, Salades, Desserts
- **50 produits** (pains traditionnels + pâtisseries)
- **TVA** : 10% défaut, TVA 0% pour pain de base
- **Features** : Code-barres, Emporter, Sur place, Fidélité

### Ce qui fonctionne bien
- ✅ Catalogue adapté (pain complet, msemen, focaccia...)
- ✅ TVA 0% pour pains de base (exonération légale)
- ✅ Gestion du stock
- ✅ Fidélité clients

### Fonctionnalités manquantes

| # | Fonctionnalité | Importance | Description |
|---|----------------|------------|-------------|
| B1 | **Scan code-barres** | CRITIQUE | Feature flag activé mais pas de lookup API. Besoin : `GET /api/produits/code-barre/:code` pour ajout rapide au panier, support caméra ou douchette USB |
| B2 | **Gestion production** | HAUTE | Planning de production : combien de baguettes/croissants produire par jour selon historique de ventes. Fiche technique par produit (recette, ingrédients, temps, coût) |
| B3 | **Gestion pertes/invendus** | HAUTE | Suivi des invendus en fin de journée, calcul du taux de perte, suggestions pour ajuster la production |
| B4 | **Prix au poids** | HAUTE | Certains produits vendus au kg (pâtisserie traditionnelle marocaine). Besoin : saisie du poids, calcul prix automatique |
| B5 | **Commandes spéciales** | MOYENNE | Gâteaux d'anniversaire, commandes de pain pour événements — prise de commande avec date de livraison, acompte, suivi |
| B6 | **Fiche technique (recette)** | MOYENNE | Lien produit → ingrédients → quantités, calcul coût de revient automatique, déduction stock ingrédients |
| B7 | **Étiquettes produits** | BASSE | Impression d'étiquettes avec code-barres, prix, composition, allergènes |
| B8 | **Gestion allergènes** | MOYENNE | Obligatoire réglementairement : gluten, lait, œufs, fruits à coque... par produit |

### Améliorations UX spécifiques
- Affichage en grille large avec photos des produits
- Boutons "+/-" quantité plus gros (flux rapide boulangerie)
- Mode vente rapide (toucher produit = ajout immédiat au panier)
- Compteur de production du jour (baguettes produites vs vendues)
- Alertes de réassort pain/viennoiseries

---

## 8. Fiche métier — BOUTIQUE / SUPERETTE 🛒

### Profil actuel
- **8 catégories** : Épicerie, Fruits & Légumes, Produits Laitiers, Boulangerie, Boissons, Hygiène, Ménage, Snacks
- **50 produits** (alimentation générale, hygiène, ménage)
- **TVA** : 7% défaut (alimentaire)
- **Features** : Code-barres, Livraison, Emporter, Fidélité

### Ce qui fonctionne bien
- ✅ Catalogue diversifié adapté au marché marocain
- ✅ TVA 7% alimentaire par défaut (correcte)
- ✅ Gestion stock avec alertes
- ✅ Fournisseurs et dépenses

### Fonctionnalités manquantes

| # | Fonctionnalité | Importance | Description |
|---|----------------|------------|-------------|
| S1 | **Scan code-barres** | CRITIQUE | Même besoin que Boulangerie. Indispensable en superette : douchette ou caméra pour scan rapide des articles |
| S2 | **Gestion des achats/réapprovisionnement** | CRITIQUE | Bon de commande fournisseur, réception marchandise avec contrôle quantité, mise à jour stock automatique, historique achats par fournisseur |
| S3 | **Prix au poids** | HAUTE | Fruits, légumes, épices vendus au kg. Saisie poids → calcul prix |
| S4 | **DLC (Date Limite de Consommation)** | HAUTE | Suivi des dates de péremption, alertes produits proches de l'expiration, gestion FIFO (premier entré, premier sorti) |
| S5 | **Multi-prix (gros/détail)** | MOYENNE | Prix unitaire vs prix en gros (ex: 1 yaourt = 3 DH, pack de 6 = 15 DH) |
| S6 | **Crédit client (ardoise)** | HAUTE | Système très courant au Maroc. Le client achète à crédit, solde affiché, rappel de paiement, historique crédit |
| S7 | **Inventaire physique** | HAUTE | Outil de comptage : comparer stock théorique vs physique, calculer écarts, ajustement en masse |
| S8 | **Gestion livraison à domicile** | MOYENNE | Feature flag activé. Besoin : zones de livraison, frais par zone, suivi commandes livraison, notification client |
| S9 | **Promotions automatiques** | MOYENNE | "3 pour le prix de 2", "Le 2ème à -50%", promotions par lot |
| S10 | **Import catalogue fournisseur** | BASSE | Import Excel/CSV des produits avec prix d'achat, mise à jour prix en masse |

### Améliorations UX spécifiques
- Interface optimisée pour scan rapide (grand champ code-barres en haut)
- Affichage du prix au kg/L pour produits au poids
- Vue "Réassort" : produits en-dessous du seuil avec suggestion de quantité
- Compteur crédit client visible dans le panier
- Alertes DLC dans le dashboard

---

## 9. Fonctionnalités transversales manquantes

Ces fonctionnalités bénéficieraient à TOUS les métiers :

### 9.1 Haute priorité

| # | Fonctionnalité | Description | Impact |
|---|----------------|-------------|--------|
| T1 | **Mode hors-ligne** | Stocker les commandes localement et synchroniser quand le réseau revient. Critique pour une app desktop NW.js | Fiabilité |
| T2 | **Export Excel** | Exporter commandes, stock, clients, stats en .xlsx | Comptabilité |
| T3 | **Import/Export données** | Import CSV des produits, export complet des données, migration | Adoption |
| T4 | **Multi-succursales (complet)** | API CRUD pour succursales, basculement entre succursales, stats par succursale | Scalabilité |
| T5 | **Variantes produit** | Taille (S/M/L), suppléments, modificateurs — architecture transversale | UX |
| T6 | **Recherche code-barres** | API `GET /produits/code-barre/:code` — utilisable par Boulangerie + Superette | Efficacité |
| T7 | **Paiement mixte** | Partie espèces + partie carte (champ `mode_paiement='mixte'` existe mais pas de UI) | Couverture |

### 9.2 Moyenne priorité

| # | Fonctionnalité | Description | Impact |
|---|----------------|-------------|--------|
| T8 | **Notifications push** | Alertes stock, fin de journée, backup | Proactivité |
| T9 | **Dashboard analytique avancé** | Graphiques interactifs, comparaison périodes, prédictions | Intelligence |
| T10 | **Personnalisation ticket avancée** | Logo image (pas emoji), QR code sur ticket, code-barres commande | Professionnalisme |
| T11 | **Gestion des retours** | Retour produit → avoir → remboursement partiel/total, impact stock | Complétude |
| T12 | **API Webhooks** | Notifications vers systèmes externes (comptabilité, ERP) | Intégration |
| T13 | **Rapports planifiés** | Envoi automatique par email des rapports journaliers/hebdos | Automatisation |

### 9.3 Basse priorité (Phase 4+)

| # | Fonctionnalité | Description |
|---|----------------|-------------|
| T14 | **Multi-langue** | Arabe, amazigh en plus du français |
| T15 | **App mobile caissier** | Version tablette/mobile du POS |
| T16 | **Intégration comptable** | Export vers logiciels comptables marocains |
| T17 | **Module formation** | Tutoriel interactif intégré pour les nouveaux utilisateurs |
| T18 | **Marketplace modules** | Architecture plugins pour extensions tierces |

---

## 10. Plan d'amélioration prioritisé

### Phase 4A — Corrections UX immédiates (2 semaines)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Ajouter loading spinners sur toutes les actions async | 1j | HAUT |
| Rendre les tables responsive (scroll horizontal) | 1j | HAUT |
| Ajouter validation inline sur les formulaires | 2j | MOYEN |
| Confirmation avant actions destructives | 0.5j | HAUT |
| Remplacer emojis par icônes SVG (cohérence) | 2j | MOYEN |
| Ajouter ARIA labels manquants | 1j | MOYEN |
| Ajouter guide des raccourcis clavier (tooltip/modal) | 0.5j | BAS |

### Phase 4B — Features critiques par métier (4 semaines)

| Tâche | Métier | Effort | Impact |
|-------|--------|--------|--------|
| API + UI scan code-barres | Boulangerie, Superette | 3j | CRITIQUE |
| Gestion des tables (plan + statuts) | Restaurant | 5j | CRITIQUE |
| KDS basique (file cuisine) | Restaurant | 5j | CRITIQUE |
| Crédit client (ardoise) | Superette | 3j | HAUT |
| Pourboires | Café, Restaurant | 2j | HAUT |
| Commande rapide / favoris | Café | 2j | HAUT |
| Paiement mixte (UI) | Tous | 1j | HAUT |

### Phase 4C — Features métier avancées (6 semaines)

| Tâche | Métier | Effort | Impact |
|-------|--------|--------|--------|
| Livraison (suivi + zones + frais) | Restaurant, Superette | 5j | HAUT |
| Gestion achats/réappro fournisseurs | Superette | 5j | HAUT |
| Gestion pertes/invendus | Boulangerie | 3j | HAUT |
| DLC (dates péremption) | Superette | 3j | HAUT |
| Variantes produit (tailles/suppléments) | Café, Restaurant | 5j | HAUT |
| Split/merge commandes | Restaurant | 3j | HAUT |
| Inventaire physique | Superette | 3j | HAUT |
| Menu du jour / Formules | Restaurant | 3j | MOYEN |
| Prix au poids | Boulangerie, Superette | 2j | HAUT |

### Phase 4D — Fonctionnalités transversales (4 semaines)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Export Excel (commandes, stock, stats) | 3j | HAUT |
| Import CSV produits | 2j | MOYEN |
| Mode hors-ligne basique | 5j | HAUT |
| Multi-succursales (CRUD complet) | 3j | MOYEN |
| Rapports PDF avancés | 3j | MOYEN |
| Notifications / alertes proactives | 2j | MOYEN |
| Logo personnalisé sur ticket (upload image) | 2j | MOYEN |

---

## Annexe : Résumé par métier — Prêt à vendre ?

| Métier | Score | Verdict | Bloqueurs vente |
|--------|-------|---------|-----------------|
| **Café** ☕ | 7/10 | ⚠️ Presque prêt | Pourboires, commande rapide |
| **Restaurant** 🍽️ | 4/10 | ❌ Pas prêt | Tables, KDS, livraison, split |
| **Boulangerie** 🍞 | 6/10 | ⚠️ Presque prêt | Scan code-barres, pertes |
| **Superette** 🛒 | 5/10 | ⚠️ À améliorer | Scan code-barres, achats, crédit, DLC |

> **Conclusion** : Le **Café** est le métier le plus proche d'être commercialisable. Le **Restaurant** nécessite le plus de travail (tables + KDS sont indispensables). La **Boulangerie** et la **Superette** nécessitent en priorité le scan code-barres.

---

*Document généré le 11/02/2026 — RITAJ SMART POS v4.1.0*
