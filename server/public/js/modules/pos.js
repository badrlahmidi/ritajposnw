/**
 * RITAJ SMART POS — Orchestrateur Principal
 * pos.js est désormais un orchestrateur léger qui assemble 6 modules spécialisés.
 *
 * Modules:
 *   catalog.js   — Produits, Catégories, Scan, Favoris
 *   cart.js      — Panier, Quantités, Tarifs, Numpad, Pourboire
 *   discount.js  — Remises, Promotions
 *   payment.js   — Encaissement, Commandes en attente, Retours
 *   ticket.js    — Impression Ticket, Z-Report, X-Report
 *   register.js  — Caisse (Ouverture/Fermeture, Mouvements)
 */
import { api } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

import { CatalogModule } from './catalog.js';
import { CartModule } from './cart.js';
import { DiscountModule } from './discount.js';
import { PaymentModule } from './payment.js';
import { TicketModule } from './ticket.js';
import { RegisterModule } from './register.js';

export const POS = {
    // Spread all modules into POS so all onclick="POS.xxx()" in HTML still work:
    ...CatalogModule,
    ...CartModule,
    ...DiscountModule,
    ...PaymentModule,
    ...TicketModule,
    ...RegisterModule,

    // ─── Delivery / Order Type ───────────────────────────────────────────────
    setOrderType(type) {
        this.orderType = type;
        if (type === 'livraison' || type === 'emporter') {
            const isLivraison = type === 'livraison';
            document.getElementById('deliveryModalTitle').textContent = isLivraison ? '🚗 Infos Livraison' : '🛍️ Infos A Emporter';
            document.getElementById('deliveryAddressGroup').style.display = isLivraison ? 'block' : 'none';
            document.getElementById('deliveryFeeGroup').style.display = isLivraison ? 'block' : 'none';
            if (this.selectedClient) {
                document.getElementById('deliveryClientName').value = this.selectedClient.nom;
                document.getElementById('deliveryPhone').value = this.selectedClient.telephone || '';
                document.getElementById('deliveryAddress').value = this.selectedClient.adresse || '';
            } else if (!this.deliveryInfo) {
                document.getElementById('deliveryClientName').value = '';
                document.getElementById('deliveryPhone').value = '';
                document.getElementById('deliveryAddress').value = '';
                document.getElementById('deliveryFee').value = '0';
            }
            document.getElementById('deliveryModal').style.display = 'flex';
        } else {
            this.deliveryInfo = null;
        }
    },

    saveDeliveryInfo() {
        const nom = document.getElementById('deliveryClientName').value;
        const tel = document.getElementById('deliveryPhone').value;
        const adr = document.getElementById('deliveryAddress').value;
        const frais = parseFloat(document.getElementById('deliveryFee').value) || 0;
        if (this.orderType === 'livraison' && !adr) {
            UI.toast("L'adresse est requise pour la livraison", 'error');
            return;
        }
        this.deliveryInfo = { nom, telephone: tel, adresse: adr, frais, client_id: this.selectedClient ? this.selectedClient.id : null };
        APP.closeModal('deliveryModal');
        UI.toast('✅ Infos enregistrées', 'success');
    },

    // ─── Client Search ──────────────────────────────────────────────────────
    openClientSearch(context = 'pos') {
        this.clientSearchContext = context;
        document.getElementById('posClientSearch').value = '';
        document.getElementById('posClientResults').innerHTML = '<p class="text-muted text-center">Tapez un nom ou téléphone...</p>';
        document.getElementById('clientSearchModal').style.display = 'flex';
        document.getElementById('posClientSearch').focus();
    },

    async searchClient(val) {
        if (val.length < 2) return;
        try {
            const clients = await api(`/clients?search=${encodeURIComponent(val)}`);
            const el = document.getElementById('posClientResults');
            if (!clients.length) { el.innerHTML = '<p class="text-muted text-center">Aucun client trouvé</p>'; return; }
            el.innerHTML = clients.map(c => `
        <div class="cart-item" style="cursor:pointer" onclick="POS.selectClient(${c.id}, '${c.nom.replace(/'/g, "\\'")}', ${c.points_fidelite}, '${c.type_tarif}')">
          <div class="cart-item-info">
            <div class="cart-item-name">${c.nom}</div>
            <div class="cart-item-price">${c.telephone || '—'} | ${c.points_fidelite} pts | ${c.nb_visites} visites</div>
          </div>
          <span class="badge badge-${c.points_fidelite >= 500 ? 'warning' : c.points_fidelite >= 100 ? 'info' : 'success'}">${c.points_fidelite >= 500 ? '⭐ Gold' : c.points_fidelite >= 100 ? '🥈 Silver' : '🥉 Bronze'}</span>
        </div>
      `).join('');
        } catch (e) { console.error(e); }
    },

    selectClient(id, nom, points, type_tarif = 'particulier') {
        const client = { id, nom, points, type_tarif };
        this.selectedClient = client;
        this.setTarif(type_tarif || 'particulier');
        document.getElementById('cartClient').style.display = 'flex';
        document.getElementById('cartClientName').textContent = nom;
        document.getElementById('cartClientPoints').textContent = points + ' pts';
        if (this.clientSearchContext === 'delivery') {
            document.getElementById('deliveryClientName').value = nom;
            api(`/clients/${id}`).then(fullClient => {
                if (fullClient) {
                    document.getElementById('deliveryPhone').value = fullClient.telephone || '';
                    document.getElementById('deliveryAddress').value = fullClient.adresse || '';
                }
            });
        }
        APP.closeModal('clientSearchModal');
        this.clientSearchContext = 'pos';
    },

    removeClient() {
        this.selectedClient = null;
        this.setTarif('particulier');
        document.getElementById('cartClient').style.display = 'none';
    },

    // ─── Initialisation ─────────────────────────────────────────────────────
    async init() {
        const orderTypeEl = document.getElementById('orderType');
        if (orderTypeEl) this.orderType = orderTypeEl.value;
        await this.loadAutoPromotions();
        await this.loadCategories();
        await this.loadProducts();
        this.renderCategories();
        this.renderProducts();
        this.renderCart();
        this.initTipSection();
        this.renderFavorites();
        setTimeout(() => this.checkRegisterStatus(), 500);
    },
};
