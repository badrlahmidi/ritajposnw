# RITAJ SMART POS

**Solution Point de Vente — Café & Restaurant — Application Desktop Tactile.**

## Version 5.0 — Édition Café & Restaurant (2026)

> **Pivot v5.0** : la solution est désormais dédiée exclusivement aux établissements **Café & Restaurant**.
> Les profils Boulangerie et Superette ont été retirés. Six profils spécialisés sont disponibles :
> `café`, `café classique`, `salon de thé`, `restaurant`, `restaurant service table`, `fast-food / snack`.

---

## Fonctionnalités v5.0

### ☕ Café & Restaurant
- **Profils ciblés** : 6 variantes de la famille Café/Restaurant, configurées pour le marché marocain
- **Gestion des tables** : plan de salle drag-and-drop, statuts (libre/occupée/réservée/à nettoyer)
- **Salles configurables** : Salle, Terrasse, Bar, VIP…
- **KDS — Kitchen Display System** : affichage cuisine temps réel, colonnes par cours (entrées/plats/desserts/boissons)
- **Envoi cuisine** : les lignes sont figées et envoyées au KDS en un clic
- **Split addition** : par lignes sélectionnées ou par montant
- **Transfert de table** : déplacer une commande vers une autre table
- **Couverts** : gestion du nombre de couverts par table
- **Réservations** : calendrier, CRUD, vue par date
- **Modifiers** : options personnalisables sur les produits (sans oignons, supplément fromage…)
- **Happy Hours** : remises automatiques par plage horaire

### 🖥️ Application Desktop Tactile (Electron)
- **Electron 30+** : remplace l'ancien NW.js, meilleur support tactile Windows 10/11
- **Plein écran kiosque** : démarrage automatique en fullscreen, verrouillage optionnel
- **Multi-écran** : KDS sur 2e écran automatiquement
- **Impression thermique** : ESC/POS (Epson TM-T20, Xprinter, Star TSP143) via réseau ou USB
- **Auto-update** : mise à jour silencieuse via electron-updater
- **Offline** : IndexedDB + Service Worker, rejeu automatique des commandes

### 🔒 Backend amélioré
- **WebSocket** temps réel (`ws://localhost:PORT/ws`) pour KDS et plan de salle
- **API standardisée** : `{ success, data }` ou `{ success, error: { code, message } }`
- **Sécurité renforcée** : bcrypt 12 rounds, Helmet CSP, rate-limit 300 req/min/IP
- **TVA marocaine** : 0%, 7%, 10%, 14%, 20% — ICE, IF, RC sur les tickets
- **Export fiscal DGI** : conforme `SPECIFICATIONS-DGI.md`
- **Backup** : toutes les 4h avec rotation (30 fichiers + archives 10 ans)

### 🎨 Frontend tactile
- **Design tokens** : cibles ≥ 56 px (actions primaires ≥ 72 px)
- **Gestes** : swipe sur ligne → actions, long-press → quantité rapide
- **Clavier virtuel** intégré (numérique + AZERTY FR/AR)
- **i18n** : Français (défaut), Arabe (RTL), Anglais
- **PWA** : Service Worker, offline mode, Lighthouse ≥ 90

---

## Prérequis

- **Node.js** v18+ (recommandé : v20 LTS ou supérieur)
- **Windows** 10/11 ou Linux (pour la version desktop Electron)
- **npm** v9+

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
