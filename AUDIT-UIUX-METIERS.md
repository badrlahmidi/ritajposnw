# RITAJ SMART POS — Plan d'amélioration Retail (Tâches Restantes)

**Date :** 12/03/2026  
**Version :** 4.2.0  
**Périmètre :** **Retail uniquement** — Superette, Épicerie, Boutique

> ⚠️ Ce document liste **uniquement** les fonctionnalités manquantes ou partielles dans le contexte retail.  
> Les modules Restaurant (Tables, KDS, Impression cuisine, Réservations, Split commandes, Modificateurs), ainsi que les fonctions avancées Café/Boulangerie sont **définitivement hors périmètre et exclus**.

---

## 1. Score global actuel (Retail)

| Domaine | Score | Commentaire |
|---------|-------|-------------|
| Backend / API | ★★★★★ (9/10) | Très solide, modules bien séparés, validé par tests |
| Base de données | ★★★★☆ (8.5/10) | Schéma complet, inventaire, crédit, DLC, multi-prix présents |
| UI/UX Design | ★★★★☆ (7.5/10) | Propre et fonctionnel, quelques détails de polish restants |
| Responsive | ★★★☆☆ (6.5/10) | Desktop OK, tablette perfectible |
| Features retail | ★★★★☆ (9/10) | Quasi complet — quelques manques ciblés |
| Performance | ★★★★☆ (8/10) | SQLite rapide, GZIP actif |
| Sécurité | ★★★★★ (9/10) | JWT, bcrypt, rate limiting, helmet, validation |

---

## 2. Fonctionnalités déjà implémentées (pour référence)

> Ces items sont **complets** et ne figurent plus dans les tâches à faire.

- ✅ Scan code-barres USB + Balance poids (EAN-13 préfixe 2x)
- ✅ Import CSV/Excel produits
- ✅ Paiement mixte (espèces + carte)
- ✅ Crédit client / Ardoise (débit, remboursement, relevé PDF)
- ✅ Achats fournisseurs avec scan produits + mise à jour stock auto
- ✅ Inventaire physique (session, scan code-barres, commit)
- ✅ DLC (dates de péremption) — saisie + alertes vue Stock
- ✅ Livraison à domicile (backend + frontend de base)
- ✅ Promotions automatiques (BOGO, 3pour2, 2ème à -50%)
- ✅ Multi-prix par client (détail / semi-gros / gros)
- ✅ Export CSV tous rapports, Impression A4 & 80mm
- ✅ Notes par ligne, Retours commandes, Commandes en attente
- ✅ Favoris fixes + tracking auto (produits fréquents)
- ✅ Pourboires (toggle feature)
- ✅ Étiquettes produits imprimables (planches A4)
- ✅ Mouvements stock historique complet

---

## 3. Tâches restantes — POS & Interface

| # | Fonctionnalité | Priorité | Description |
|---|----------------|----------|-------------|
| P1 | **Alerte dette client dans le panier** | HAUTE | Quand un client avec `solde_credit > 0` est sélectionné, afficher un badge rouge avec son montant dû directement dans le panier (avant même d'arriver au paiement) |
| P2 | **Variantes produit — UI caisse** | HAUTE | La BDD supporte `parent_id` / `variante_attributs` mais aucune UI ne permet de choisir une variante en caisse (ex: huile 500ml vs 1L vs 5L même produit) |
| P3 | **Recherche globale** | MOYENNE | Champ de recherche rapide multi-vues (clients + produits + commandes) |
| P4 | **Remise temporelle automatique** | MOYENNE | Remise qui s'active sur une plage horaire ou un jour de semaine (ex: -5% le samedi) |

---

## 4. Tâches restantes — Produits & Stock

| # | Fonctionnalité | Priorité | Description |
|---|----------------|----------|-------------|
| S1 | **DLC widget dans le Dashboard** | HAUTE | Actuellement les alertes DLC sont dans la vue Stock. Ajouter un widget/badge dans le Dashboard principal indiquant le nb de produits proches de péremption avec lien direct |
| S2 | **Gestion des pertes / casse** | MOYENNE | Ajouter un motif "Casse" ou "Perte" dans les ajustements de stock. Rapport des pertes valorisées par période |
| S3 | **Étiquettes code-barres réelles (EAN-13)** | MOYENNE | Les étiquettes imprimées affichent des barres fictives. Intégrer `JsBarcode` pour générer un vrai code-barres scannable |
| S4 | **FIFO alertes sur nouveaux lots** | BASSE | Suggérer de vendre le lot le plus ancien quand un nouveau lot entre en stock pour un produit périssable |
| S5 | **Réassort automatique suggéré** | BASSE | Quantité recommandée à commander basée sur la vélocité (ventes des 7 derniers jours) |

---

## 5. Tâches restantes — Clients & Fidélité

| # | Fonctionnalité | Priorité | Description |
|---|----------------|----------|-------------|
| C1 | **Liste des dettes importantes** | HAUTE | Dans la vue Clients, un filtre rapide "Clients en dette" avec solde > seuil configurable. Actuellement on voit la dette mais sans vue dédiée |
| C2 | **Fidélité avec avantages automatiques** | BASSE | Les niveaux Gold/Silver/Bronze sont affichés mais sans remise automatique selon le niveau |

---

## 6. Tâches restantes — Rapports & Stats

| # | Fonctionnalité | Priorité | Description |
|---|----------------|----------|-------------|
| R1 | **Export Excel (.xlsx)** | HAUTE | L'export CSV existe. Ajouter `.xlsx` formaté via la lib `xlsx` (npm) — les clients attendent du Excel |
| R2 | **Rapport achats fournisseurs** | HAUTE | Historique détaillé des achats par fournisseur, cumul mensuel, dernière livraison — actuellement uniquement dans les dépenses |
| R3 | **Rapport des pertes/casse** | MOYENNE | Rapport dédié des mouvements de type "casse/perte" avec montant valorisé |
| R4 | **Graphiques interactifs** | MOYENNE | Les barres sont des `<div>` statiques. Intégrer Chart.js pour des graphiques hover/click avec comparaison N-1 |
| R5 | **Rapports planifiés par email** | BASSE | Envoi automatique du rapport journalier à une adresse email configurée |

---

## 7. Tâches restantes — Administration & Système

| # | Fonctionnalité | Priorité | Notes |
|---|----------------|----------|-------|
| **A1** | **🔴 Installeur Windows (.msi / .exe)** | CRITIQUE | Bloquant commercial — distribution actuelle en ZIP/portable |
| **A2** | **🔴 Licensing / Activation** | CRITIQUE | Bloquant commercial — pas de protection contre la copie non autorisée |
| **A3** | **🔴 Canal de support** | CRITIQUE | WhatsApp Business ou email dédié — obligatoire avant 1er déploiement |
| A4 | **Système d'auto-update (NW.js)** | HAUTE | Chaque mise à jour nécessite une intervention manuelle chez le client |
| A5 | **Multi-succursales CRUD** | HAUTE | Table `succursales` en BDD mais zéro API CRUD ni UI admin |
| A6 | **Mode hors-ligne basique** | HAUTE | Si le processus Node.js plante, l'app est inutilisable. Stocker les commandes localement en attendant |
| A7 | **Manuel utilisateur finalisé** | HAUTE | Existant mais non finalisé — PDF avec captures d'écran à distribuer |
| A8 | **Validation format XML DGI** | MOYENNE | En attente du schéma XSD officiel DGI |
| A9 | **Signature électronique DGI** | BASSE | À implémenter si exigée — specs non encore publiées |

---

## 8. Tâches restantes — UI/UX

| # | Fonctionnalité | Priorité | Notes |
|---|----------------|----------|-------|
| U1 | **Responsive tablette (700–900px)** | HAUTE | Tables admin débordent, layout POS un peu serré |
| U2 | **Logo image sur ticket** | MOYENNE | Upload PNG pour le logo (actuellement texte) |
| U3 | **QR Code sur ticket** | BASSE | Lien Google Maps ou site web sur le ticket client |
| U4 | **`aria-live` zones dynamiques** | BASSE | Panier/total non annoncés aux lecteurs d'écran |
| U5 | **Icônes SVG cohérentes** | BASSE | Emojis inconsistants selon OS — remplacer par SVG |

---

## 9. Plan d'action priorisé

### 🔴 Bloquants commerciaux (avant 1er client)

| Tâche | Effort |
|-------|--------|
| Installeur Windows (.msi / NSIS / Squirrel) | 3j |
| Système de licensing / clé d'activation | 4j |
| Canal de support (WhatsApp Business) | 0.5j |
| Manuel utilisateur PDF final | 2j |

### 🟠 Haute priorité fonctionnelle (Sprint 1)

| Tâche | Effort |
|-------|--------|
| Alerte dette client dans le panier | 0.5j |
| Widget DLC dans le Dashboard | 0.5j |
| Liste clients en dette (filtre rapide) | 0.5j |
| Export Excel (.xlsx) via lib `xlsx` | 2j |
| Rapport achats fournisseurs | 1j |
| Responsive tablette Admin | 1j |
| Multi-succursales CRUD API + UI | 3j |

### 🟡 Moyenne priorité (Sprint 2)

| Tâche | Effort |
|-------|--------|
| Variantes produit — UI caisse | 4j |
| Étiquettes code-barres réelles (JsBarcode) | 1j |
| Gestion des pertes / casse | 2j |
| Rapport des pertes valorisées | 1j |
| Graphiques interactifs (Chart.js) | 3j |
| Remise temporelle automatique | 2j |
| Système auto-update NW.js | 3j |

### 🔵 Basse priorité (Sprint 3+)

| Tâche | Effort |
|-------|--------|
| Logo image sur ticket | 1j |
| QR Code sur ticket | 1j |
| FIFO alertes lots | 2j |
| Réassort suggéré | 2j |
| Rapports planifiés email | 2j |
| Fidélité automatique (avantages par niveau) | 2j |
| Validation XML DGI | 3j |

---

*Document mis à jour le 12/03/2026 — RITAJ SMART POS v4.2 — Périmètre Retail uniquement*
