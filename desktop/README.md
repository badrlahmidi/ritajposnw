# RITAJ Smart POS — Guide Desktop (Electron)

## Installation développement

```bash
# Prérequis : Node.js 18+

# 1. Installer les dépendances serveur
cd server && npm install

# 2. Installer les dépendances desktop
cd ../desktop && npm install

# 3. Lancer en mode développement (serveur + Electron)
npm run dev
```

## Build installateur Windows

```bash
cd desktop
npm install
npm run build:win
# → Génère desktop/dist/RITAJ Smart POS Setup 5.0.0.exe
```

## Variables d'environnement Electron

| Variable      | Valeur par défaut | Description                            |
|---------------|-------------------|----------------------------------------|
| `PORT`        | `3000`            | Port du serveur Node intégré           |
| `NODE_ENV`    | `production`      | Mode serveur                           |
| `KIOSK`       | `true`            | Mode kiosque plein écran (false = off) |

## Multi-écran KDS

Si un 2e écran est connecté au démarrage, l'application ouvre automatiquement
la vue **Kitchen Display System (KDS)** sur le second moniteur.

Pour ouvrir manuellement le KDS depuis l'app :
```js
window.ritaj.openKDS();
```

## Imprimantes thermiques

Les imprimantes ESC/POS sont configurées dans l'interface Admin :
- **Type** : Ticket (caisse) / Cuisine (KDS) / Bar
- **Connexion** : IP:Port (réseau) ou USB (driver ESC/POS natif)
- **Testés** : Epson TM-T20, Xprinter XP-80, Star TSP143

## Mise à jour automatique

L'application vérifie les mises à jour au démarrage via GitHub Releases.
Pour configurer le serveur de mise à jour, définir `publish` dans `package.json`.

## Mode kiosque

En mode kiosque (`KIOSK=true`) :
- Démarrage en fullscreen automatique
- `Alt+F4`, `F11`, `Ctrl+W` désactivés
- Pour quitter : passer par l'interface Admin → Système → Quitter

## Désinstallation

Depuis "Programmes et fonctionnalités" Windows, ou via le raccourci
"Désinstaller RITAJ Smart POS" dans le menu Démarrer.
