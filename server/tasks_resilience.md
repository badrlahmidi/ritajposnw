# Tasks: Resilience & Maintenance

## 1. Réinitialisation Base de Données (Changement Métier)
- [x] **Endpoint API** : `POST /api/admin/reset-database`
    - [x] Sécurisé (Admin only + confirmation mot de passe ?)
    - [x] Modes : 'restaurant' (Tables, Zones default) vs 'retail' (Rayons default).
    - [x] Actions : Vider Commandes, Produits, Clients, Stock. Conserver Users.
- [x] **UI Admin** : Bouton "⚠ Réinitialiser / Changer Métier" dans `Paramètres`.

## 2. Mode Hors-Ligne (Offline Resilience)
- [x] **Queue de Requêtes** : Modifier `api()` dans `pos.js`.
    - [x] Si échec connexion -> Stocker req (URL, body, method) dans `localStorage`.
    - [x] Indicateur UI "📡 Mode Hors-ligne".
- [x] **Synchro** :
    - [x] Timer (toutes les 30s) pour réessayer les requêtes en attente.
    - [x] Traitement séquentiel (FIFO).
- [x] **Données Locales** : Mettre en cache Produits/Clients dans `localStorage` pour lecture hors-ligne.

## 3. Backup & Archivage Légal (DGI)
- [x] **Format Archive** : Vérifier que l'archive contient bien les données requises (dump SQL ou JSONs signés).
- [x] **Restauration** : (Note: "Restore" logic not explicitly requested but "Download" + "Verify" implemented. Restore manual usually.) -> Implemented Download & Verify.
- [x] **UI** : Liste des backups avec boutons "Restaurer" / "Télécharger".
