# RITAJ SMART POS — Procédure de Conservation des Données (10 ans)

## Conformité DGI Maroc — Article 211 du Code Général des Impôts

---

## 1. Cadre légal

Le Code Général des Impôts du Maroc (Article 211) impose aux contribuables de **conserver les documents comptables et pièces justificatives pendant une durée de 10 ans** à compter de la date de la dernière opération.

Cette obligation couvre :
- Les factures émises (ventes)
- Les factures reçues (achats/dépenses)
- Les livres comptables
- Les pièces justificatives de toute nature

---

## 2. Stratégie de conservation RITAJ SMART POS

### 2.1 Architecture des backups

```
server/backups/
├── pos_backup_auto_YYYY-MM-DDTHH-MM-SS.db      (automatiques)
├── pos_backup_auto_YYYY-MM-DDTHH-MM-SS.db.sha256
├── pos_backup_manual_YYYY-MM-DDTHH-MM-SS.db     (manuels)
├── pos_backup_manual_YYYY-MM-DDTHH-MM-SS.db.sha256
└── archives/
    ├── ritaj_archive_2026-01.db                  (archivage mensuel)
    ├── ritaj_archive_2026-01.db.sha256
    ├── ritaj_archive_2026-02.db
    ├── ritaj_archive_2026-02.db.sha256
    └── ...
```

### 2.2 Types de backups

| Type | Fréquence | Rétention | Hash | Description |
|------|-----------|-----------|------|-------------|
| **Auto** | Toutes les 4h | 90 derniers (≈ 15 jours) | SHA-256 | Backup automatique de la base complète |
| **Manuel** | À la demande | Illimitée | SHA-256 | Backup déclenché par l'administrateur |
| **Archive DGI** | Mensuel (recommandé) | **10 ans minimum** | SHA-256 | Archive officielle pour conformité fiscale |

### 2.3 Hash d'intégrité

Chaque backup est accompagné d'un fichier `.sha256` contenant le hash SHA-256 du fichier de base de données. Ce hash permet de :

1. **Détecter toute altération** du fichier de backup
2. **Prouver l'intégrité** des données en cas de contrôle fiscal
3. **Vérifier la validité** avant toute restauration

---

## 3. Procédures opérationnelles

### 3.1 Créer un backup d'archivage (mensuel recommandé)

#### Via l'interface RITAJ SMART POS :

1. Connectez-vous en tant qu'**administrateur**
2. Allez dans **Administration > Paramètres**
3. Cliquez sur **"Créer archive DGI"**
4. Le système génère une archive dans `server/backups/archives/`

#### Via l'API :

```bash
curl -X POST http://localhost:3000/api/backup/archive \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

#### Réponse :
```json
{
  "success": true,
  "path": "server/backups/archives/ritaj_archive_2026-02.db"
}
```

### 3.2 Vérifier l'intégrité d'un backup

#### Via l'API :

```bash
curl -X POST http://localhost:3000/api/backup/verify \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "ritaj_archive_2026-02.db"}'
```

#### Réponse :
```json
{
  "valid": true,
  "actualHash": "abc123...",
  "storedHash": "abc123...",
  "size": 1048576,
  "file": "ritaj_archive_2026-02.db"
}
```

### 3.3 Lister les backups disponibles

```bash
curl http://localhost:3000/api/backup/list \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

### 3.4 Restaurer un backup

> **ATTENTION** : La restauration remplace TOUTES les données actuelles.

1. Arrêtez le serveur RITAJ SMART POS
2. Créez un backup de sécurité de la base actuelle
3. Remplacez le fichier `server/pos.db` par le fichier de backup souhaité
4. Relancez le serveur

```bash
# 1. Arrêter le serveur
# 2. Copier le backup
cp server/backups/archives/ritaj_archive_2026-02.db server/pos.db
# 3. Relancer le serveur
cd server && node server.js
```

---

## 4. Plan de conservation externe (recommandé)

Pour garantir la conservation 10 ans même en cas de défaillance matérielle, nous recommandons une **stratégie 3-2-1** :

### Règle 3-2-1 :
- **3** copies de chaque archive
- **2** supports différents (disque local + cloud ou disque externe)
- **1** copie hors site (cloud ou bureau distant)

### 4.1 Copie locale

Les archives sont stockées dans `server/backups/archives/`. Ce dossier doit être **exclu de tout nettoyage automatique** et **sauvegardé régulièrement**.

### 4.2 Copie sur support externe

**Procédure mensuelle** (à la fin de chaque mois) :

1. Branchez un disque dur externe ou clé USB
2. Copiez le dossier `server/backups/archives/` complet
3. Vérifiez l'intégrité des fichiers copiés (comparer les hash SHA-256)
4. Étiquetez le support : `RITAJ SMART POS — Archives DGI — Mois/Année`
5. Rangez dans un lieu sûr (coffre, armoire fermée)

### 4.3 Copie cloud (optionnel mais recommandé)

Options recommandées pour le Maroc :
- **Google Drive** (15 Go gratuits)
- **Dropbox** (2 Go gratuits)
- **OneDrive** (5 Go gratuits)
- **Serveur NAS** local avec synchronisation

**Script de copie vers un dossier cloud synchronisé** :

```bash
# Exemple : copie vers dossier Google Drive synchronisé
cp -r server/backups/archives/ "/path/to/Google Drive/RITAJ_Archives/"
```

---

## 5. Vérification périodique (audit interne)

### Checklist trimestrielle :

- [ ] Vérifier que les archives mensuelles sont bien créées
- [ ] Lancer une vérification d'intégrité sur les 3 dernières archives
- [ ] Vérifier les copies externes (disque dur, cloud)
- [ ] Tester une restauration sur un environnement de test
- [ ] Documenter le résultat de la vérification

### Checklist annuelle :

- [ ] Vérifier l'intégrité de TOUTES les archives de l'année
- [ ] Créer une copie complète sur un nouveau support
- [ ] Archiver les backups automatiques de l'année écoulée
- [ ] Mettre à jour cette procédure si nécessaire

---

## 6. Données conservées dans chaque archive

Chaque archive SQLite contient la totalité des données :

| Table | Contenu | Volume typique |
|-------|---------|---------------|
| `commandes` | Toutes les commandes/factures | Plusieurs milliers/an |
| `commande_lignes` | Détail de chaque article vendu | x3 à x10 des commandes |
| `produits` | Catalogue produits | Centaines |
| `clients` | Clients et fidélité | Centaines à milliers |
| `stock` | État du stock | = nb produits |
| `mouvements_stock` | Historique des mouvements | Milliers/an |
| `depenses` | Toutes les dépenses | Centaines/an |
| `fournisseurs` | Répertoire fournisseurs | Dizaines |
| `sessions_caisse` | Ouvertures/fermetures caisse | ~365/an |
| `audit_log` | Journal d'audit complet | Milliers/an |
| `parametres` | Configuration du système | ~50 entrées |
| `utilisateurs` | Comptes utilisateurs | Dizaines |
| `taxes` | Taux TVA configurés | ~5 |

### Taille estimée :
- **1 an** d'activité : 5–50 Mo
- **10 ans** d'archives : 50–500 Mo
- Compatible avec stockage sur clé USB, disque externe, ou cloud gratuit

---

## 7. Hash d'intégrité des factures

En plus de l'intégrité des backups, chaque **commande/facture** individuelle possède un hash d'intégrité (`hash_integrite` dans la table `commandes`). Ce hash est calculé à la création de la commande et est :

- **Imprimé** sur chaque facture PDF
- **Stocké** en base de données
- **Vérifiable** pour détecter toute modification a posteriori

Formule : `SHA-256(numero + date_creation + total + ICE)`

---

## 8. Contacts et responsabilités

| Rôle | Responsabilité |
|------|---------------|
| **Administrateur système** | Vérification mensuelle des backups, création des archives |
| **Gérant/Propriétaire** | Validation des procédures, stockage des copies externes |
| **Comptable** | Utilisation des exports PDF/JSON pour la comptabilité |

---

*Document créé le 11/02/2026 — RITAJ SMART POS v4.1*
*Conforme aux exigences de conservation du CGI Maroc (Article 211)*
