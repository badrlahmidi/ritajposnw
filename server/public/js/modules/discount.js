import { api } from '../core/api.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

export const DiscountModule = {
    autoPromos: [],

    async loadAutoPromotions() {
        try {
            const all = await api('/remises');
            // Filtrer uniquement celles liées à un produit et de type auto (non montant/pourcentage) ou avec produit_id défini
            this.autoPromos = all.filter(r => r.produit_id && ['bogo', '3_pour_2', '2eme_50'].includes(r.type));
        } catch (e) {
            console.warn('Erreur chargement promos auto', e);
        }
    },

    calculateAutoPromotions(cartRows) {
        let totalAutoDiscount = 0;
        if (!this.autoPromos || !this.autoPromos.length) return 0;

        // Parcourir les articles du panier
        cartRows.forEach(item => {
            const promo = this.autoPromos.find(p => p.produit_id === item.id);
            if (promo && item.quantite >= 2) {
                const q = item.quantite;
                const p = item.prix_ttc;
                let remiseCalc = 0;

                if (promo.type === 'bogo') {
                    // Chaque 2 produits = 1 offert. On calcule le nombre de paires
                    const freeItems = Math.floor(q / 2);
                    remiseCalc = freeItems * p;
                } else if (promo.type === '3_pour_2') {
                    // Chaque 3 produits = 1 offert
                    const freeItems = Math.floor(q / 3);
                    remiseCalc = freeItems * p;
                } else if (promo.type === '2eme_50') {
                    // Chaque 2 produits = 50% sur le 2eme (donc -0.5 * prix)
                    const halfPricedItems = Math.floor(q / 2);
                    remiseCalc = halfPricedItems * (p * 0.5);
                }

                totalAutoDiscount += remiseCalc;
            }
        });

        return totalAutoDiscount;
    },

    openDiscountModal() {
        document.getElementById('discountValue').value = '';
        api('/remises').then(remises => {
            const el = document.getElementById('activePromotions');
            if (remises.length) {
                el.innerHTML = '<h4 class="mb-8">Promotions actives:</h4>' + remises.map(r => `
          <div class="cart-item" style="cursor:pointer" onclick="POS.applyPromotion(${r.id}, '${r.type}', ${r.valeur})">
            <div class="cart-item-info">
              <div class="cart-item-name">${r.nom}</div>
              <div class="cart-item-price">${r.type === 'pourcentage' ? r.valeur + '%' : r.valeur + ' DH'}</div>
            </div>
            <span class="badge badge-warning">Appliquer</span>
          </div>
        `).join('');
            } else { el.innerHTML = ''; }
        }).catch(() => { });
        document.getElementById('discountModal').style.display = 'flex';
    },

    applyDiscount() {
        const type = document.getElementById('discountType').value;
        const val = parseFloat(document.getElementById('discountValue').value);
        if (!val || val <= 0) { UI.toast('Valeur invalide', 'error'); return; }
        this.discount = { type, valeur: val };
        this.renderCart();
        APP.closeModal('discountModal');
        UI.toast('🏷️ Remise appliquée', 'success');
    },

    applyPromotion(id, type, valeur) {
        this.discount = { type, valeur };
        this.renderCart();
        APP.closeModal('discountModal');
        UI.toast('🏷️ Promotion appliquée', 'success');
    },

    removeDiscount() {
        this.discount = null;
        const rr = document.getElementById('remiseRow'); if (rr) rr.style.display = 'none';
        this.renderCart();
    },
};
