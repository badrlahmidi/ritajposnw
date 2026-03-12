# Audit Retail — Tâches Restantes
*Date de mise à jour: 12/03/2026*
*Périmètre : Application **Retail uniquement** (Superette, Épicerie, Boutique)*

> Ce document ne liste que les tâches **manquantes ou à améliorer** dans le périmètre retail.  
> Les modules Restaurant (Tables, KDS, Livraison cuisine, Réservations), Café et Boulangerie avancés sont **hors périmètre** et exclus.

---

## Domaine 1 : 🛒 POS & Interface de Vente

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| P1 | **Recherche globale rapide** | MOYENNE | Champ de recherche unique multi-vues (clients, produits, commandes) |
| ~~P2~~ | ~~**Variantes produit — UI complète**~~ | ~~HAUTE~~ | ✅ **FAIT** — Modal de sélection des variantes (parent_id) rajouté en caisse |
| P3 | **Programme de remise temporelle (Promotion jour/heure)** | MOYENNE | Remises qui s'activent automatiquement sur une période définie (ex : -10% le vendredi) |
| P4 | **Notifications push desktop** | MOYENNE | Alertes stock bas, fin de session caisse, backup automatique — via `Notification API` ou toast persistent |
| ~~C1~~ | ~~**Alerte visuelle dette client dans panier**~~ | ~~HAUTE~~ | ✅ **FAIT 12/03** — Bandeau rouge avec montant dû + bouton Régler dès sélection d'un client endetté |

---

## Domaine 2 : 📦 Produits & Catalogue

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| D1 | **Étiquettes code-barres réelles** | MOYENNE | Les étiquettes imprimées affichent `||| || |||` fictif — pas un vrai EAN-13 lisible par douchette. Besoin : intégrer `JsBarcode` ou `bwip-js` |
| D2 | **Photo produit sur le ticket** | BASSE | Afficher la photo du produit sur le ticket 80mm (optionnel) |
| D3 | **Gestion par lot / UVC** | BASSE | Vendre un pack de 6 = 1 lot, déduire 6 unités du stock. Actuellement gérable via le numpad mais sans lien automatique avec l'UVC défini |

---

## Domaine 3 : 📦 Stock & Inventaire

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| ~~S1~~ | ~~**Alertes DLC dans le Dashboard**~~ | ~~HAUTE~~ | ✅ **FAIT 12/03** — Widget jaune dans le Dashboard avec nb de produits expirés + lien direct vers Stock |
| S2 | **Gestion FIFO automatique** | MOYENNE | Alerte proactive quand un nouveau lot entre en stock pour un produit avec DLC — suggérer de vendre le lot le plus ancien |
| S3 | **Réassort automatique suggéré** | BASSE | Calcul de la quantité recommandée à commander basé sur la vélocité de vente (7 jours) |
| ~~S4~~ | ~~**Gestion des pertes / casse**~~ | ~~MOYENNE~~ | ✅ **FAIT** — Panneau 'Perte' ajouté pour tracer les stocks abîmés (Casse/Vol/Péremption) |

---

## Domaine 4 : 👥 Clients & Fidélité

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| ~~C1~~ | ~~**Alerte visuelle dette client**~~ | ~~HAUTE~~ | ✅ **FAIT 12/03** — Widget rouge dans le Dashboard avec encours total + nb clients |
| C2 | **Alertes dettes importantes** | MOYENNE | Liste des clients avec dette > seuil configurable (ex : > 200 DH) dans le dashboard ou la vue clients |
| C3 | **Programme fidélité avec avantages automatiques** | BASSE | Les paliers Gold/Silver/Bronze sont affichés en UI mais sans avantages automatiques |

---

## Domaine 5 : 📊 Rapports & Statistiques

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| ~~R1~~ | ~~**Export Excel (.xlsx) natif**~~ | ~~HAUTE~~ | ✅ **FAIT 12/03** — Bouton "Excel" dans les Rapports, lib `xlsx` intégrée, tous rapports supportés |
| ~~R2~~ | ~~**Rapport fournisseurs**~~ | ~~HAUTE~~ | ✅ **FAIT 12/03** — Nouveau rapport "Achats Fournisseurs" avec synthèse par fournisseur + détail |
| R3 | **Graphiques interactifs (Chart.js)** | MOYENNE | Les graphiques barres sont des `<div>` statiques. Pas de zoom, hover, comparaison N-1 |
| ~~R4~~ | ~~**Rapport des pertes/casse**~~ | ~~MOYENNE~~ | ✅ **FAIT** — Synthèse des pertes et réparations par motif |
| R5 | **Rapports planifiés** | BASSE | Envoi automatique du rapport journalier par email |

---

## Domaine 6 : ⚙️ Administration & Système

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| ~~A1~~ | ~~**Multi-succursales CRUD complet**~~ | ~~HAUTE~~ | ✅ **FAIT** — Menu d'administration ajouté pour gérer les branches du réseau |
| A2 | **Installeur Windows (.msi / .exe)** | CRITIQUE | Distribué en ZIP/portable actuellement. Bloquant pour la commercialisation |
| A3 | **Système de mise à jour auto (NW.js)** | CRITIQUE | Pas de mécanisme d'auto-update. Chaque MAJ nécessite une intervention manuelle |
| A4 | **Système de licensing / activation** | CRITIQUE | Pas de protection contre la copie. Bloquant avant le premier client pilote |
| A5 | **Manuel utilisateur finalisé** | HAUTE | Document existant mais non finalisé ni mis en forme pour distribution |
| A6 | **Mode hors-ligne basique** | HAUTE | App NW.js desktop sans stockage local : si le serveur node local plante, toutes les ventes sont bloquées |
| A7 | **Validation format XML DGI** | HAUTE | En attente de la publication du schéma XSD par la DGI — à vérifier dès disponible |
| A8 | **Signature électronique DGI** | MOYENNE | À implémenter si exigée par la DGI (specs non publiées) |
| A9 | **Canal de support client** | HAUTE | WhatsApp Business ou email dédié pour les premiers clients pilotes |

---

## Domaine 7 : 🎨 UI/UX & Accessibilité

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| ~~U1~~ | ~~**Responsive tablette (700–900px)**~~ | ~~HAUTE~~ | ✅ **FAIT 12/03** — CSS admin-tabs, view-header et view-actions adaptés pour tablette |
| U2 | **Logo image sur ticket** | MOYENNE | Upload d'une image PNG pour le logo (actuellement texte uniquement) |
| U3 | **QR Code sur ticket** | BASSE | Lien vers avis Google Maps ou site web du commerce sur le ticket |
| U4 | **`aria-live` zones dynamiques** | BASSE | Panier et total non annoncés aux lecteurs d'écran |
| U5 | **Icônes SVG** | BASSE | Emojis inconsistants selon OS — remplacer par SVG pour une cohérence cross-platform |

---

## Récapitulatif — Prêt à Vendre ?

| Métier | Score | Verdict | Bloqueurs |
|--------|-------|---------|-----------|
| **Superette / Épicerie** 🛒 | 9.5/10 | ✅ Prêt à 95% | Installeur Windows, Licensing |
| **Boutique** 🏪 | 9/10 | ✅ Prêt à 90% |  |

**Bloquants commerciaux (avant 1er déploiement client)** :
1. 🔴 Installeur Windows (.msi)
2. 🔴 Système de licensing / activation  
3. 🔴 Canal de support client

**Prochaines priorités fonctionnelles** :
1. 🟡 Graphiques interactifs Chart.js  
2. 🟡 Logo image sur ticket 80mm
3. 🟡 Gestion par lot / UVC

---
*Document mis à jour le 12/03/2026 — RITAJ SMART POS v4.2 — Périmètre : Retail uniquement*

