# RITAJ SMART POS — Manuel Utilisateur v4.1

## Guide complet d'utilisation

---

## Table des matières

1. [Premiers pas](#1-premiers-pas)
2. [Connexion et rôles](#2-connexion-et-rôles)
3. [Interface principale](#3-interface-principale)
4. [Gestion de la caisse](#4-gestion-de-la-caisse)
5. [Prise de commandes](#5-prise-de-commandes)
6. [Gestion des produits](#6-gestion-des-produits)
7. [Gestion du stock](#7-gestion-du-stock)
8. [Clients et fidélité](#8-clients-et-fidélité)
9. [Dépenses](#9-dépenses)
10. [Statistiques et rapports](#10-statistiques-et-rapports)
11. [Paramètres et configuration](#11-paramètres-et-configuration)
12. [Sauvegarde et sécurité](#12-sauvegarde-et-sécurité)
13. [Résolution de problèmes](#13-résolution-de-problèmes)

---

## 1. Premiers pas

### 1.1 Lancement de l'application

**Méthode Windows (bureau):**
1. Double-cliquez sur le fichier `demarrer.bat`
2. La fenêtre du serveur s'ouvre automatiquement
3. L'application RITAJ SMART POS se lance dans sa fenêtre

**Méthode navigateur:**
1. Lancez le serveur via `demarrer.bat` ou `npm start` dans le dossier `server/`
2. Ouvrez votre navigateur à l'adresse : `http://localhost:3000/pos`

### 1.2 Assistant de configuration (Setup Wizard)

Au premier lancement, l'assistant vous guide :

1. **Choix du profil métier** : sélectionnez votre activité
   - **Café** : Boissons chaudes, froides, pâtisseries
   - **Restaurant** : Entrées, plats, desserts, boissons
   - **Boulangerie** : Pains, viennoiseries, pâtisseries
   - **Superette** : Produits alimentaires, frais, hygiène

2. **Informations commerciales** :
   - Nom du commerce
   - Adresse complète
   - Numéro de téléphone
   - ICE (Identifiant Commun de l'Entreprise)

3. **Création du compte administrateur** :
   - Login (identifiant de connexion)
   - Mot de passe (minimum 4 caractères)
   - Nom et prénom

> **Important** : Le profil métier préremplira les catégories, produits et taxes adaptés à votre activité. Vous pourrez tout personnaliser ensuite.

---

## 2. Connexion et rôles

### 2.1 Se connecter

1. Entrez votre **login** et **mot de passe**
2. Cliquez sur **Se connecter**
3. En cas d'oubli, contactez votre administrateur

> **Sécurité** : Après 10 tentatives échouées, l'accès est bloqué pendant 15 minutes.

### 2.2 Les rôles utilisateurs

| Rôle | Droits |
|------|--------|
| **Admin** | Accès complet : utilisateurs, paramètres, rapports, backup |
| **Manager** | Gestion produits, stock, commandes, stats (pas de gestion utilisateurs) |
| **Caissier** | Prise de commandes, ouverture/fermeture caisse, consultation produits |

---

## 3. Interface principale

L'interface est organisée en sections accessibles via le menu latéral :

- **Caisse** : Interface de vente principale
- **Commandes** : Historique et gestion des commandes
- **Produits** : Catalogue et gestion des produits
- **Stock** : Niveaux de stock et réapprovisionnement
- **Clients** : Base de données clients et fidélité
- **Dépenses** : Suivi des dépenses
- **Statistiques** : Rapports et analyses
- **Paramètres** : Configuration du système (admin uniquement)

---

## 4. Gestion de la caisse

### 4.1 Ouvrir la caisse

1. Accédez à la section **Caisse**
2. Cliquez sur **Ouvrir la caisse**
3. Saisissez le **fond de caisse** (montant en espèces au démarrage)
4. Validez

### 4.2 Fermer la caisse

1. Cliquez sur **Fermer la caisse**
2. Saisissez le **montant réel** comptabilisé physiquement
3. Le système calcule automatiquement l'**écart** (différence entre attendu et réel)
4. Ajoutez une note si nécessaire
5. Validez la fermeture

### 4.3 Résumé de session

À la fermeture, vous obtenez :
- Total des ventes
- Total espèces / carte
- Nombre de commandes
- Écart de caisse

---

## 5. Prise de commandes

### 5.1 Créer une commande

1. **Sélectionnez les produits** en cliquant dessus dans le catalogue
   - Filtrez par catégorie via les onglets en haut
   - Utilisez la barre de recherche pour trouver un produit rapidement
2. **Ajustez les quantités** avec les boutons + / -
3. **Choisissez le type** : Sur place, À emporter, Livraison
4. **Optionnel** : Associez un client pour la fidélité
5. **Appliquez une remise** si nécessaire

### 5.2 Encaisser

1. Sélectionnez le **mode de paiement** : Espèces ou Carte
2. Pour les espèces, saisissez le **montant reçu**
3. Le système calcule la **monnaie à rendre**
4. Validez la commande

### 5.3 Ticket / Reçu

Après validation :
- Le numéro de commande s'affiche (ex: CMD-20260211-0001)
- Le ticket inclut : détails des articles, TVA, total, monnaie rendue
- Les informations de votre commerce (nom, adresse, ICE)

### 5.4 Annuler une commande

> Réservé aux rôles **admin** et **manager**

1. Allez dans **Commandes** > trouvez la commande
2. Cliquez sur **Annuler**
3. Le stock est automatiquement restauré
4. Les points de fidélité sont retirés au client

---

## 6. Gestion des produits

### 6.1 Ajouter un produit

> Rôle requis : **admin** ou **manager**

1. Allez dans **Produits** > **Ajouter**
2. Remplissez :
   - **Nom** du produit
   - **Prix TTC** (le prix HT est calculé automatiquement selon la taxe)
   - **Catégorie**
   - **Taux de TVA** applicable
   - **Code-barre** (optionnel, pour lecteur de codes-barres)
   - **Coût de revient** (pour calcul de marge)
   - **Stock initial**
3. Validez

### 6.2 Modifier un produit

1. Cliquez sur le produit dans la liste
2. Modifiez les champs souhaités
3. Enregistrez

### 6.3 Désactiver un produit

Plutôt que de supprimer, désactivez un produit pour le masquer de la vente tout en conservant l'historique.

### 6.4 Catégories

- Créez des catégories pour organiser vos produits
- Chaque catégorie a un nom, une couleur et un ordre d'affichage
- Les catégories sont pré-remplies selon votre profil métier

### 6.5 Taxes (TVA)

Les taux marocains sont pré-configurés :

| Taux | Application |
|------|-------------|
| **0%** | Produits exonérés (pain, lait...) |
| **7%** | Produits de première nécessité |
| **10%** | Restauration, hôtellerie |
| **14%** | Transport, énergie |
| **20%** | Taux normal |

---

## 7. Gestion du stock

### 7.1 Consulter le stock

1. Allez dans **Stock**
2. Visualisez les quantités par produit
3. Les produits en alerte (stock <= seuil) sont signalés en rouge

### 7.2 Alertes stock

Le système génère des alertes quand un produit passe sous son seuil d'alerte. Consultez les alertes dans **Stock** > **Alertes**.

### 7.3 Ajuster le stock

> Rôle requis : **admin** ou **manager**

1. Sélectionnez un produit
2. Saisissez la **nouvelle quantité**
3. Indiquez le **motif** (réapprovisionnement, inventaire, perte...)
4. Validez

### 7.4 Mouvements de stock

Consultez l'historique complet des mouvements :
- **Entrées** : réapprovisionnement, ajustements positifs
- **Sorties** : ventes, ajustements négatifs
- Filtrez par produit et par date

> **Automatique** : Chaque vente décrémente le stock. Chaque annulation le restaure.

---

## 8. Clients et fidélité

### 8.1 Ajouter un client

1. Allez dans **Clients** > **Ajouter**
2. Renseignez : nom, téléphone, email, adresse
3. Validez

### 8.2 Programme de fidélité

- **1 DH dépensé = 1 point de fidélité**
- Les points s'accumulent automatiquement à chaque achat
- Le total des achats et le nombre de visites sont tracés

### 8.3 Associer un client à une commande

Lors de la prise de commande, sélectionnez le client :
- Les points sont automatiquement crédités
- L'historique des achats est mis à jour

---

## 9. Dépenses

### 9.1 Enregistrer une dépense

> Rôle requis : **admin** ou **manager**

1. Allez dans **Dépenses** > **Ajouter**
2. Remplissez :
   - **Catégorie** (fournitures, loyer, salaires, matières premières...)
   - **Montant**
   - **Description**
   - **Fournisseur** (optionnel)
   - **Mode de paiement**
   - **Date**
3. Validez

### 9.2 Consulter les dépenses

Filtrez par période pour visualiser les dépenses. Le total apparaît dans les statistiques pour le calcul du bénéfice brut.

---

## 10. Statistiques et rapports

### 10.1 Statistiques du jour

Disponible pour tous les rôles :
- Nombre de commandes
- Chiffre d'affaires (TTC / HT)
- TVA collectée
- Répartition espèces / carte
- Panier moyen
- Top 10 des produits
- Ventes par heure
- Dépenses du jour
- Bénéfice brut

### 10.2 Statistiques par période

> Rôle requis : **admin** ou **manager**

1. Sélectionnez une **date de début** et une **date de fin**
2. Consultez :
   - Évolution des ventes par jour
   - Comparatifs
   - Top produits de la période

---

## 11. Paramètres et configuration

> Rôle requis : **admin**

### 11.1 Informations du commerce

- Nom du commerce
- Adresse, téléphone
- ICE (numéro fiscal)
- Logo (si supporté)

### 11.2 Gestion des utilisateurs

- Créer des comptes (admin, manager, caissier)
- Modifier les rôles et mots de passe
- Activer / désactiver des comptes

### 11.3 Gestion des remises

Créez des remises prédéfinies :
- Type : pourcentage ou montant fixe
- Montant minimum d'achat
- Dates de validité

---

## 12. Sauvegarde et sécurité

### 12.1 Sauvegardes automatiques

- La base de données est sauvegardée **automatiquement toutes les 4 heures**
- Les sauvegardes sont stockées dans le dossier `server/backups/`
- Format : `backup-AAAA-MM-JJ_HH-MM-SS.db`

### 12.2 Sauvegarde manuelle

> Rôle requis : **admin**

1. Allez dans **Paramètres** > **Backup**
2. Cliquez sur **Créer une sauvegarde**
3. Le fichier est enregistré automatiquement

### 12.3 Journal d'audit

Toutes les actions sont tracées dans le journal d'audit :
- Connexions / déconnexions
- Créations et modifications
- Ventes et annulations
- Ouvertures et fermetures de caisse
- Ajustements de stock

### 12.4 Bonnes pratiques de sécurité

- Changez le mot de passe admin régulièrement
- N'utilisez jamais le compte admin pour la vente quotidienne
- Créez des comptes caissier individuels pour tracer les opérations
- Faites des sauvegardes manuelles avant toute mise à jour
- Conservez les fichiers de backup sur un support externe (clé USB, cloud)

---

## 13. Résolution de problèmes

### Le serveur ne démarre pas

1. Vérifiez que Node.js est installé : ouvrez un terminal et tapez `node -v`
2. Vérifiez que les dépendances sont installées : `cd server && npm install`
3. Vérifiez que le port 3000 n'est pas déjà utilisé

### L'application ne se charge pas dans le navigateur

1. Vérifiez que le serveur est bien lancé (la fenêtre terminal affiche "EN LIGNE")
2. Essayez l'URL : `http://localhost:3000/pos`
3. Videz le cache du navigateur (Ctrl+Shift+Suppr)

### La caisse ne s'ouvre pas

- Vérifiez qu'aucune autre session n'est déjà ouverte
- Seul un utilisateur à la fois peut ouvrir la caisse par succursale

### Mot de passe oublié

Seul un administrateur peut réinitialiser les mots de passe. Si le mot de passe admin est perdu, vous devrez intervenir en base de données.

### Stock incorrect

1. Consultez les **mouvements de stock** pour identifier l'écart
2. Effectuez un **ajustement manuel** avec le motif "Inventaire"
3. Notez la raison de l'écart pour le suivi

### Erreur "Trop de tentatives de connexion"

Attendez 15 minutes ou demandez à l'administrateur de redémarrer le serveur.

---

## Support

**RITAJ SMART POS** — Solution Point de Vente Multi-Métier pour le marché marocain

Version : 4.1.0 | 2026

---
