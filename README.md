# RITAJ SMART POS

**Solution Point de Vente Multi-Métier pour le marché marocain.**

Version 4.1 | 2026

---

## Fonctionnalités

- **Multi-métier** : Profils préconfigurés pour Café, Restaurant, Boulangerie, Superette
- **TVA marocaine** : Taux conformes (0%, 7%, 10%, 14%, 20%)
- **ICE** : Identifiant Commun de l'Entreprise sur chaque ticket
- **Gestion de caisse** : Ouverture/fermeture, fond de caisse, écarts
- **Stock** : Suivi en temps réel, alertes de seuil, mouvements
- **Clients & Fidélité** : Programme de points, historique d'achats
- **Remises & Promotions** : Pourcentage ou montant fixe
- **Rapports** : Statistiques journalières et par période, top produits
- **Rôles** : Admin, Manager, Caissier avec permissions distinctes
- **Thème sombre** : Interface moderne avec dark mode
- **Backup automatique** : Sauvegarde toutes les 4 heures

---

## Prérequis

- **Node.js** v18+ (recommandé : v20 LTS ou supérieur)
- **Windows** 10/11 (pour la version desktop NW.js)

---

## Installation

### 1. Cloner le projet

```bash
git clone <repo-url> ritaj-smart-pos
cd ritaj-smart-pos
```

### 2. Installer les dépendances

```bash
cd server
npm install
```

### 3. Configurer l'environnement

```bash
cp .env.example .env
```

Editez `.env` et **changez obligatoirement** `JWT_SECRET` en production.

### 4. Lancer le serveur

```bash
npm start
```

Le serveur démarre sur `http://localhost:3000/pos`

### 5. Lancement rapide (Windows)

Double-cliquez sur `demarrer.bat` à la racine du projet. Le serveur et l'application desktop se lancent automatiquement.

---

## Structure du projet

```
ritaj-smart-pos/
├── server/                  # Backend Node.js + Express
│   ├── server.js            # API REST (~40 endpoints)
│   ├── db.js                # Base SQLite (sql.js)
│   ├── config.js            # Configuration centralisée
│   ├── business-profiles.js # Profils métier (café, restaurant, etc.)
│   ├── .env                 # Variables d'environnement (non versionné)
│   ├── .env.example         # Modèle de configuration
│   ├── pos.db               # Base de données SQLite
│   ├── backups/             # Sauvegardes automatiques
│   └── public/              # Frontend SPA
│       ├── index.html
│       ├── css/pos.css
│       └── js/pos.js
├── win32/                   # Application desktop (NW.js)
├── demarrer.bat             # Script de lancement Windows
├── README.md
├── LICENSE
└── AUDIT-ET-ROADMAP.md      # Audit et feuille de route
```

---

## Configuration

Toutes les variables sont dans `server/.env` :

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | `3000` |
| `BASE_PATH` | Chemin de base de l'API | `/pos` |
| `JWT_SECRET` | Clé secrète JWT (changer en production !) | — |
| `JWT_EXPIRES` | Durée de validité des tokens | `12h` |
| `CORS_ORIGINS` | Origines autorisées (virgules) | vide |
| `APP_NAME` | Nom affiché | `RITAJ SMART POS` |
| `APP_VERSION` | Version | `4.1.0` |

---

## Utilisation

### Premier lancement

1. Lancez le serveur (`npm start`)
2. Ouvrez `http://localhost:3000/pos` dans votre navigateur
3. Le **Setup Wizard** se lance automatiquement :
   - Choisissez votre type de commerce (Café, Restaurant, Boulangerie, Superette)
   - Renseignez les informations de votre commerce
   - Créez votre compte administrateur
4. Vous êtes prêt à utiliser RITAJ SMART POS

### Comptes par défaut

Après le setup wizard, deux comptes sont créés :
- **Admin** : le compte que vous avez configuré
- **Caissier** : login `caissier` / mot de passe `caisse123`

---

## API

L'API REST est accessible à `http://localhost:3000/pos/api/`. Toutes les routes (sauf setup et login) requièrent un token JWT dans le header `Authorization: Bearer <token>`.

### Endpoints principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Utilisateur courant |
| GET | `/api/produits` | Liste des produits |
| POST | `/api/commandes` | Créer une commande |
| GET | `/api/stats/jour` | Statistiques du jour |
| GET | `/api/stock` | État du stock |
| GET | `/api/clients` | Liste des clients |

---

## Sécurité

- **JWT** : Tokens signés avec expiration configurable
- **Bcrypt** : Mots de passe hashés (salt rounds = 10)
- **Rate limiting** : 10 tentatives de login max par 15 minutes par IP
- **CORS** : Origines restreintes configurables
- **Rôles** : 3 niveaux (admin, manager, caissier)
- **Audit** : Journal complet des actions

---

## Licence

Copyright (c) 2026 RITAJ SMART POS. Tous droits réservés.
Voir le fichier [LICENSE](LICENSE) pour plus de détails.
