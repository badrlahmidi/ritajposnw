# 📋 Roadmap — RITAJ SMART POS (Retail)

**Date de mise à jour :** 12 mars 2026  
**Version actuelle :** v4.2  
**Périmètre :** **Retail uniquement** — Superette, Épicerie, Boutique

> Les modules Restaurant, Café avancé et Boulangerie avancé sont **exclus du périmètre** et ne seront pas développés.

---

## Statut des phases terminées ✅

| Phase | Contenu | Statut |
|-------|---------|--------|
| Phase 1 — Stabilisation | JWT, Helmet, SQLite, Backups auto | ✅ Terminé |
| Phase 2 — Qualité / Tests | 49 tests unitaires, couverture routes critiques | ✅ Terminé |
| Phase 3A — Core POS | Caisse, TVA 5 taux, Tickets, Clients, Fidélité, Remises manuelles | ✅ Terminé |
| Phase 3B — UX | Loading states, tables responsive, validation inline, confirmDialog, raccourcis | ✅ Terminé |
| Phase 3C — Retail Core | Scan code-barres + balance poids, multi-prix, favoris, pourboires | ✅ Terminé |
| Phase 3D — Stock avancé | Achats fournisseurs, Inventaire physique, DLC, Mouvements | ✅ Terminé |
| Phase 3E — Clients avancé | Crédit client / Ardoise, Relevé PDF, Règlement dette | ✅ Terminé |
| Phase 3F — Promotions | BOGO, 3pour2, 2ème -50%, Remises par catégorie/produit | ✅ Terminé |
| Phase 3G — Rapports | Stock valorisation, Marges, Audit log, CSV export, A4 & 80mm | ✅ Terminé |
| Phase 3H — Produits | Import CSV/Excel, Variantes BDD, Étiquettes planches A4 | ✅ Terminé |

---

## Phase 4 — Priorités immédiates (Haute valeur, faible effort)

> Ces tâches peuvent être faites rapidement et améliorent significativement l'expérience.

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| 4.1 | **Alerte dette client dans le panier** | 0.5j | HAUTE |
| 4.2 | **Widget DLC dans le Dashboard** | 0.5j | HAUTE |
| 4.3 | **Filtre "Clients en dette"** (vue Clients) | 0.5j | HAUTE |
| 4.4 | **Export Excel (.xlsx)** via lib `xlsx` | 2j | HAUTE |
| 4.5 | **Rapport achats fournisseurs** | 1j | HAUTE |
| 4.6 | **Responsive Admin tablette** | 1j | HAUTE |

---

## Phase 5 — Packaging & Commercialisation (BLOQUANTS)

> **À compléter avant le premier déploiement client.**

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| **5.1** | **Installeur Windows** (.msi ou .exe via NSIS / Electron Builder) | 3j | 🔴 CRITIQUE |
| **5.2** | **Système de licensing / Activation** (clé par commerce, protection copie) | 4j | 🔴 CRITIQUE |
| **5.3** | **Canal de support client** (WhatsApp Business ou email dédié) | 0.5j | 🔴 CRITIQUE |
| 5.4 | **Manuel utilisateur finalisé** (PDF + captures d'écran) | 2j | HAUTE |
| 5.5 | **Système d'auto-update NW.js** (mise à jour silencieuse chez le client) | 3j | HAUTE |

---

## Phase 6 — Multi-succursales

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| 6.1 | **API CRUD Succursales** (`GET/POST/PUT /api/succursales`) | 2j | HAUTE |
| 6.2 | **UI Admin Multi-succursales** (créer, modifier, basculer) | 2j | HAUTE |
| 6.3 | **Stats filtrées par succursale** | 1j | HAUTE |
| 6.4 | **Stock par succursale** (déjà en BDD via `succursale_id`) | 1j | HAUTE |

---

## Phase 7 — Variantes & Produits avancés

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| 7.1 | **UI Variantes en caisse** (sélecteur S/M/L, 500g/1kg/5kg à l'ajout produit) | 4j | HAUTE |
| 7.2 | **Étiquettes code-barres réelles** (JsBarcode EAN-13 — actuellement fictif) | 1j | MOYENNE |
| 7.3 | **Remise temporelle automatique** (plage horaire ou jour de semaine) | 2j | MOYENNE |
| 7.4 | **Gestion des pertes/casse** (motif + rapport valorisé) | 2j | MOYENNE |

---

## Phase 8 — Analytics & Rapports avancés

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| 8.1 | **Graphiques interactifs** (Chart.js, hover, comparaison N-1) | 3j | MOYENNE |
| 8.2 | **Rapport pertes/casse** (mouvements type "perte" valorisés) | 1j | MOYENNE |
| 8.3 | **FIFO alertes lots** (suggestion vente lot le plus ancien) | 2j | BASSE |
| 8.4 | **Réassort suggéré** (basé sur vélocité 7 jours) | 2j | BASSE |
| 8.5 | **Rapports planifiés email** (rapport journalier auto) | 2j | BASSE |

---

## Phase 9 — Conformité DGI & Finitions

| # | Tâche | Effort | Impact |
|---|-------|--------|--------|
| 9.1 | **Validation format XML DGI** | 3j | En attente schéma XSD officiel |
| 9.2 | **Signature électronique DGI** | 3j | Si exigée — specs non publiées |
| 9.3 | **Test restauration archive 10 ans** | 1j | Légal |
| 9.4 | **Logo image sur ticket** (upload PNG) | 1j | MOYENNE |
| 9.5 | **QR Code sur ticket** | 1j | BASSE |
| 9.6 | **Mode hors-ligne basique** | 5j | HAUTE |

---

## Risques & Points d'attention

| Risque | Niveau | Mitigation |
|--------|--------|-----------|
| **Packaging bloquant** : sans installeur + licensing, pas de vente possible | 🔴 HAUT | Prioriser la phase 5 en premier |
| **DGI specs** : schéma XSD pas encore publié | 🟡 MOYEN | En veille — ne pas bloquer les autres phases |
| **Support** : premiers clients génèrent des demandes imprévues | 🟡 MOYEN | WhatsApp Business dès le jour 1 du déploiement |
| **Multi-succursales** : data existante en BDD mais API manquante | 🟡 MOYEN | Phase 6 — à faire avant les clients multi-points de vente |

---

## Historique des versions

- **v4.2 (12/03/2026)** : Module retail complet — Scan, Inventaire, Achats fournisseurs, DLC, Crédit client, Multi-prix, Export CSV, Rapports avancés, Promotions auto, Étiquettes, Variantes BDD. **Périmètre Retail fixé.**
- **v4.1 (12/02/2026)** : Audit sécurité, tests unitaires (49 tests), rebranding RITAJ SMART POS.
- **v4.0** : Version initiale multi-métier.
