import { api } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';

export const CartModule = {
    cart: [],
    discount: null,
    selectedClient: null,
    clientSearchContext: 'pos',
    currentTarif: 'particulier',
    orderType: 'emporter',
    deliveryInfo: null,
    modeRetour: false,
    numpadBuffer: '',
    currentTip: 0,

    numpadModalState: { value: '', callback: null },

    toggleModeRetour() {
        this.modeRetour = !this.modeRetour;
        const btn = document.getElementById('btnModeRetour');
        if (this.modeRetour) {
            btn.classList.add('active');
            btn.style.background = 'var(--danger)';
            btn.style.color = 'white';
            UI.toast('Mode Remboursement activé', 'info');
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.color = 'var(--danger)';
            UI.toast('Mode Normal activé', 'info');
        }
    },

    numpadAction(val) {
        const display = document.getElementById('numpadDisplay');
        if (val === 'C') {
            this.numpadBuffer = '';
            if (display) display.textContent = '';
            return;
        }
        if (val === 'QTY') {
            if (!this.numpadBuffer) return;
            const qty = parseFloat(this.numpadBuffer);
            if (isNaN(qty) || qty <= 0) { UI.toast('Quantité invalide', 'warning'); return; }
            if (this.cart.length > 0) {
                const idx = this.cart.length - 1;
                this.cart[idx].quantite = qty;
                this.cart[idx].sous_total_ht = +(this.cart[idx].quantite * this.cart[idx].prix_ht).toFixed(2);
                this.cart[idx].sous_total_ttc = +(this.cart[idx].quantite * this.cart[idx].prix_ttc).toFixed(2);
                this.cart[idx].montant_tva = +(this.cart[idx].sous_total_ttc - this.cart[idx].sous_total_ht).toFixed(2);
                this.renderCart();
                this.numpadBuffer = '';
                if (display) display.textContent = '';
                UI.toast(`Quantité modifiée : ${qty}`, 'success');
            } else { UI.toast('Panier vide', 'warning'); }
            return;
        }
        if (this.numpadBuffer.length > 5) return;
        this.numpadBuffer += val.toString();
        if (display) display.textContent = this.numpadBuffer;
    },

    getPrixSelonTarif(p, tarif) {
        if (tarif === 'gros') return p.prix_gros || p.prix_ttc;
        if (tarif === 'semi_gros') return p.prix_semi_gros || p.prix_ttc;
        return p.prix_ttc;
    },

    setTarif(tarif) {
        this.currentTarif = tarif;
        document.querySelectorAll('.tariff-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tarif === tarif);
            btn.style.background = btn.dataset.tarif === tarif ? 'var(--primary)' : '';
            btn.style.color = btn.dataset.tarif === tarif ? '#fff' : '';
        });
        this.cart.forEach(item => {
            const prixBase = this.getPrixSelonTarif({ prix_ttc: item.prix_unit_detail || item.prix_ttc, prix_semi_gros: item.prix_unit_semi, prix_gros: item.prix_unit_gros }, tarif);
            item.type_tarif = tarif;
            item.prix_ttc = prixBase;
            item.prix_ht = +(prixBase / (1 + (item.taux_tva || 0) / 100)).toFixed(2);
            item.sous_total_ht = +(item.quantite * item.prix_ht).toFixed(2);
            item.sous_total_ttc = +(item.quantite * item.prix_ttc).toFixed(2);
            item.montant_tva = +(item.sous_total_ttc - item.sous_total_ht).toFixed(2);
        });
        this.renderCart();
    },

    addToCart(productId, productObj, quantity = null) {
        const p = productObj || this.produits.find(x => x.id === productId);
        if (!p) return;

        let qtyToAdd = 1;
        if (quantity !== null) qtyToAdd = quantity;
        else if (this.numpadBuffer) {
            const parsed = parseFloat(this.numpadBuffer);
            if (!isNaN(parsed) && parsed > 0) {
                qtyToAdd = parsed;
                this.numpadBuffer = '';
                const display = document.getElementById('numpadDisplay');
                if (display) display.textContent = '';
            }
        }

        if (this.orderType === 'retour' || this.modeRetour) qtyToAdd = -Math.abs(qtyToAdd);

        this.trackFavorite(p.id);
        const prixApplied = this.getPrixSelonTarif(p, this.currentTarif);
        const existing = this.cart.find(x => x.produit_id === productId);
        const totalRequested = (existing ? existing.quantite : 0) + qtyToAdd;

        const allowNegative = state.params.feature_negative_stock === '1';
        if (!allowNegative && this.orderType !== 'retour' && !this.modeRetour && totalRequested > p.stock_quantite) {
            UI.toast(`⚠️ Stock insuffisant ! Limité à ${p.stock_quantite} (Vente en négatif désactivée)`, 'error');
            return;
        }

        if (existing) {
            existing.quantite += qtyToAdd;
            existing.quantite = parseFloat(existing.quantite.toFixed(3));
            if (existing.quantite === 0) {
                const idx = this.cart.indexOf(existing);
                if (idx > -1) this.cart.splice(idx, 1);
            } else {
                existing.prix_ttc = prixApplied;
                existing.prix_ht = +(prixApplied / (1 + (p.taux_tva || 0) / 100)).toFixed(2);
                existing.sous_total_ht = +(existing.quantite * existing.prix_ht).toFixed(2);
                existing.sous_total_ttc = +(existing.quantite * existing.prix_ttc).toFixed(2);
                existing.montant_tva = +(existing.sous_total_ttc - existing.sous_total_ht).toFixed(2);
            }
        } else {
            this.cart.push({
                produit_id: p.id, nom: p.nom,
                prix_ht: +(prixApplied / (1 + (p.taux_tva || 0) / 100)).toFixed(2),
                prix_ttc: prixApplied,
                taux_tva: p.taux_tva || 0,
                prix_unit_detail: p.prix_ttc,
                prix_unit_semi: p.prix_semi_gros || 0,
                prix_unit_gros: p.prix_gros || 0,
                type_tarif: this.currentTarif,
                quantite: qtyToAdd,
                sous_total_ht: +(+(prixApplied / (1 + (p.taux_tva || 0) / 100)).toFixed(2) * qtyToAdd).toFixed(2),
                sous_total_ttc: +(prixApplied * qtyToAdd).toFixed(2),
                montant_tva: +((prixApplied - (prixApplied / (1 + (p.taux_tva || 0) / 100))) * qtyToAdd).toFixed(2)
            });
        }
        this.renderCart();
    },

    updateQty(i, delta) {
        const item = this.cart[i]; if (!item) return;
        const sign = item.quantite < 0 ? -1 : 1;
        const newQty = item.quantite + (delta * sign);

        const allowNegative = state.params.feature_negative_stock === '1';
        const p = this.produits.find(x => x.id === item.produit_id);
        if (p && !allowNegative && item.quantite > 0 && newQty > p.stock_quantite) {
            UI.toast(`⚠️ Stock insuffisant ! Limité à ${p.stock_quantite} (Vente en négatif désactivée)`, 'error');
            return;
        }
        item.quantite = parseFloat(newQty.toFixed(3));
        if (item.quantite === 0) { this.cart.splice(i, 1); }
        else {
            item.sous_total_ht = +(item.quantite * item.prix_ht).toFixed(2);
            item.sous_total_ttc = +(item.quantite * item.prix_ttc).toFixed(2);
            item.montant_tva = +(item.sous_total_ttc - item.sous_total_ht).toFixed(2);
        }
        this.renderCart();
    },

    openNumpadModal(title, initialValue, callback) {
        this.numpadModalState.value = initialValue ? initialValue.toString() : '';
        this.numpadModalState.callback = callback;
        document.getElementById('numpadTitle').textContent = title;
        document.getElementById('numpadValueDisplay').textContent = this.numpadModalState.value;
        document.getElementById('numpadModal').style.display = 'flex';
    },

    numpadModalAction(val) {
        if (val === 'C') { this.numpadModalState.value = ''; }
        else if (val === '.') { if (!this.numpadModalState.value.includes('.')) this.numpadModalState.value += '.'; }
        else {
            if (this.numpadModalState.value === '0' && val !== '.') this.numpadModalState.value = val.toString();
            else this.numpadModalState.value += val.toString();
        }
        document.getElementById('numpadValueDisplay').textContent = this.numpadModalState.value;
    },

    numpadModalConfirm() {
        const val = parseFloat(this.numpadModalState.value);
        if (this.numpadModalState.callback) this.numpadModalState.callback(isNaN(val) ? null : val);
        if (window.APP) APP.closeModal('numpadModal');
    },

    editQuantity(i) {
        const item = this.cart[i];
        this.openNumpadModal(`Quantité: ${item.nom}`, item.quantite, (val) => {
            if (val !== null) {
                const q = parseFloat(val);
                if (!isNaN(q)) {
                    if (q <= 0) this.removeFromCart(i);
                    else {
                        this.cart[i].quantite = q;
                        this.cart[i].sous_total_ht = +(q * this.cart[i].prix_ht).toFixed(2);
                        this.cart[i].sous_total_ttc = +(q * this.cart[i].prix_ttc).toFixed(2);
                        this.cart[i].montant_tva = +(this.cart[i].sous_total_ttc - this.cart[i].sous_total_ht).toFixed(2);
                        this.renderCart();
                    }
                }
            }
        });
    },

    removeFromCart(i) { this.cart.splice(i, 1); this.renderCart(); },

    async addNoteToItem(i) {
        const item = this.cart[i];
        if (!item) return;
        const note = await UI.promptDialog(`Note pour : ${item.nom}`, item.notes || '');
        if (note !== null) {
            item.notes = note.trim();
            this.renderCart();
        }
    },

    clearCart() {
        if (!this.cart.length) return;
        this.cart = []; this.discount = null; this.selectedClient = null;
        this.deliveryInfo = null; this.orderType = 'emporter';
        const cc = document.getElementById('cartClient'); if (cc) cc.style.display = 'none';
        const rr = document.getElementById('remiseRow'); if (rr) rr.style.display = 'none';
        this._hideDebtBanner();
        this.renderCart(); this.hideChangeSection();
    },

    _hideDebtBanner() {
        const b = document.getElementById('cartDebtBanner');
        if (b) b.style.display = 'none';
    },

    async _showDebtBannerIfNeeded(client) {
        if (!client || !client.id) { this._hideDebtBanner(); return; }
        try {
            const data = await (await import('../core/api.js')).api(`/clients/${client.id}/credits`);
            const solde = data ? data.solde || 0 : 0;
            let banner = document.getElementById('cartDebtBanner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'cartDebtBanner';
                banner.style.cssText = 'display:none;background:#e74c3c;color:#fff;padding:8px 12px;border-radius:6px;margin:0 0 8px 0;font-size:0.85rem;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0';
                const cartItems = document.getElementById('cartItems');
                if (cartItems && cartItems.parentNode) {
                    cartItems.parentNode.insertBefore(banner, cartItems);
                }
            }
            if (solde > 0) {
                banner.innerHTML = `
                  <span>⚠️ Ardoise <strong>${client.nom}</strong> : <strong style="font-size:1rem">${solde.toFixed(2)} DH</strong> dû</span>
                  <button onclick="CLIENTS.settleCredit(${client.id}, '${client.nom.replace(/'/g, "\\'")}'  , ${solde})" style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.5);color:#fff;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap">💰 Régler</button>`;
                banner.style.display = 'flex';
            } else {
                banner.style.display = 'none';
            }
        } catch (e) { this._hideDebtBanner(); }
    },

    async repeatLastOrder(clientId) {
        if (!clientId) return;
        try {
            const orders = await api(`/commandes?client_id=${clientId}&limit=1`);
            if (!orders || orders.length === 0) {
                UI.toast('Aucune commande précédente trouvée', 'warning');
                return;
            }
            if (this.cart.length > 0) {
                const ok = await UI.confirmDialog('Panier non vide', 'Écraser le panier actuel avec la dernière commande de ce client ?');
                if (!ok) return;
            }
            this.clearCart();
            const order = await api(`/commandes/${orders[0].id}`);
            if (order && order.lignes) {
                for (const l of order.lignes) {
                    const p = this.produits.find(x => x.id === l.produit_id);
                    if (p) this.addToCart(p.id, p, l.quantite);
                }
                UI.toast('Dernière commande rechargée !', 'success');
            }
        } catch (e) {
            UI.toast('Erreur: ' + e.message, 'error');
        }
    },


    getTotals() {
        const totalHt = this.cart.reduce((s, i) => s + i.sous_total_ht, 0);
        const totalTtc = this.cart.reduce((s, i) => s + i.sous_total_ttc, 0);
        const totalTva = +(totalTtc - totalHt).toFixed(2);

        // Auto Promotions (Bundle)
        let autoDiscount = this.calculateAutoPromotions ? this.calculateAutoPromotions(this.cart) : 0;

        // Manual Discount
        let remiseManual = 0;
        if (this.discount) {
            if (this.discount.type === 'pourcentage') remiseManual = +(totalTtc * this.discount.valeur / 100).toFixed(2);
            else remiseManual = Math.min(this.discount.valeur, totalTtc);
        }

        const remise = +(autoDiscount + remiseManual).toFixed(2);
        const total = +(totalTtc - remise).toFixed(2);
        return { totalHt: +totalHt.toFixed(2), totalTva, totalTtc: +totalTtc.toFixed(2), remise, total, autoDiscount, remiseManual };
    },

    renderCart() {
        const container = document.getElementById('cartItems');
        const btnE = document.getElementById('btnEspeces');
        const btnC = document.getElementById('btnCarte');

        if (!this.cart.length) {
            container.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span><p>Aucun article</p></div>`;
            document.getElementById('subtotalHT').textContent = '0.00 DH';
            document.getElementById('totalTVA').textContent = '0.00 DH';
            document.getElementById('totalAmount').textContent = '0.00 DH';
            document.getElementById('totalAmount').style.color = '';
            if (btnE) btnE.disabled = true;
            if (btnC) btnC.disabled = true;
            const btnM = document.getElementById('btnMixte'); if (btnM) btnM.disabled = true;
            const btnExpress = document.getElementById('btnExpressCash'); if (btnExpress) btnExpress.disabled = true;
            const btnPay = document.getElementById('btnGlobalPay');
            if (btnPay) {
                btnPay.disabled = true;
                btnPay.innerHTML = `💵 PAYER <span id="payBtnAmount" style="font-weight:400;margin-left:8px">0.00 DH</span>`;
                btnPay.style.background = 'var(--success)';
            }
            return;
        }

        container.innerHTML = this.cart.map((item, i) => `
      <div class="cart-item" onclick="POS.editQuantity(${i})" style="cursor:pointer;${item.quantite < 0 ? 'background:#fff0f0;border-left:4px solid var(--danger)' : ''}">
        <div class="cart-item-info">
          <div class="cart-item-name">
            ${item.nom} ${item.quantite < 0 ? '<small class="text-danger">(RETOUR)</small>' : ''}
            <button onclick="event.stopPropagation(); POS.addNoteToItem(${i})" style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:12px" title="Ajouter une note">📝</button>
          </div>
          <div class="cart-item-price">${item.prix_ttc.toFixed(2)} DH${item.taux_tva ? ' <small>(TVA ' + item.taux_tva + '%)</small>' : ''}</div>
          ${item.notes ? `<div style="font-size:12px;color:var(--primary);margin-top:2px;font-style:italic">👉 ${item.notes}</div>` : ''}
        </div>
        <div class="cart-item-qty">
          <button onclick="event.stopPropagation(); POS.updateQty(${i},-1)">−</button>
          <span>${item.quantite}</span>
          <button onclick="event.stopPropagation(); POS.updateQty(${i},1)">+</button>
        </div>
        <div class="cart-item-total" style="${item.sous_total_ttc < 0 ? 'color:var(--danger)' : ''}">${item.sous_total_ttc.toFixed(2)}</div>
        <button class="cart-item-remove" onclick="event.stopPropagation(); POS.removeFromCart(${i})">✕</button>
      </div>
    `).join('');

        const t = this.getTotals();
        document.getElementById('subtotalHT').textContent = t.totalHt.toFixed(2) + ' DH';
        document.getElementById('totalTVA').textContent = t.totalTva.toFixed(2) + ' DH';
        document.getElementById('totalAmount').textContent = t.total.toFixed(2) + ' DH';
        document.getElementById('totalAmount').style.color = t.total < 0 ? 'var(--danger)' : 'var(--primary)';

        if (t.remise > 0) {
            document.getElementById('remiseRow').style.display = 'flex';
            document.getElementById('remiseAmount').textContent = '-' + t.remise.toFixed(2) + ' DH';
        } else {
            document.getElementById('remiseRow').style.display = 'none';
        }

        if (btnE) btnE.disabled = false;
        if (btnC) btnC.disabled = false;
        const btnM = document.getElementById('btnMixte'); if (btnM) btnM.disabled = false;

        const btnPay = document.getElementById('btnGlobalPay');
        const btnExpress = document.getElementById('btnExpressCash');

        if (btnExpress) {
            btnExpress.disabled = t.total <= 0; // Disable fast cash for refunds or 0 amount
        }

        if (btnPay) {
            btnPay.disabled = false;
            if (t.total < 0) {
                btnPay.innerHTML = `↩️ REMBOURSER <span id="payBtnAmount" style="font-weight:400;margin-left:8px">${Math.abs(t.total).toFixed(2)} DH</span>`;
                btnPay.style.background = 'var(--warning)';
            } else {
                btnPay.innerHTML = `💵 PAYER <span id="payBtnAmount" style="font-weight:400;margin-left:8px">${t.total.toFixed(2)} DH</span>`;
                btnPay.style.background = 'var(--success)';
            }
        }
        container.scrollTop = container.scrollHeight;
    },

    setTip(amount) {
        this.currentTip = Math.max(0, amount);
        const display = document.getElementById('tipDisplay');
        if (display) display.textContent = this.currentTip > 0 ? `+${this.currentTip.toFixed(2)} DH` : '';
        document.querySelectorAll('#tipSection .btn-sm').forEach(b => b.classList.remove('btn-primary'));
    },

    initTipSection() {
        const tipSection = document.getElementById('tipSection');
        if (!tipSection) return;
        if (state.params.feature_pourboire === '1') tipSection.style.display = 'block';
    },
};
