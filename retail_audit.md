# Audit Retail & Feuille de Route - Statut
*Date de mise à jour: 26/02/2026*

## Domaine 1 : 🛒 POS & Interface de Vente
**Statut: ✅ TERMINE**

*   ✅ **Notes par ligne** : Implémenté (`<button>📝</button>` dans le panier et support BDD via `notes`).
*   ✅ **Modes de Paiement** : Implémenté Virement et Chèque configurables depuis l'Administration.
*   ✅ **Favoris Fixes** : Implémenté avec ajout depuis l'administration (`est_favori` en BDD et `☆ / ⭐` dans le UI).
*   ✅ **Vente en Devises** : (Rejetée par l'utilisateur, fonction retirée du code).

---

## Domaine 2 : 📦 Produits & Catalogue
**Statut: ✅ TERMINE**

*   ✅ **Import CSV / Excel** : Parcourir un CSV de produits (Nom, Code-barres, Prix Achat, Prix Vente, Catégorie, Qté) et créer / mettre à jour les produits en base.
*   ✅ **Promotions Automatiques & Conditionnelles** : (ex: *3 pour le prix de 2*, ou *2ème à -50%*).

---

## Domaine 3 : 📦 Stock & Inventaire
**Statut: 🔄 EN COURS**
1.  **Achats & Commandes Fournisseurs**
    *   ✅ **Formulaire d'Achat** : Création d'un formulaire dédié pour la réception des commandes fournisseurs avec scan de produits.
    *   ✅ **Mise à jour Auto** : L'achat ajoute les quantités au stock et crée un mouvement `entree`.
    *   ✅ **Gestion Dépenses** : Le montant total est imputé au journal des dépenses.
2.  **Suivi DLC (Dates de Péremption)**
    *   ✅ **Backend** : Filtres et alertes SQL prévues (`/dlc/alertes`).
    *   ✅ **Frontend** : Interface ajoutée (`STOCK.showAlertesDLC()`).
