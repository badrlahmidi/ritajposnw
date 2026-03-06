import { api } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';
import { beepSuccess, beepError } from '../core/sounds.js';

export const PaymentModule = {
    pmTendered: 0,
    pmBuffer: '0',
    lastOrder: null,
    currentPaymentMode: '',

    async expressCash() {
        if (!this.cart.length) return;
        this.currentPaymentMode = 'especes';
        const t = this.getTotals();
        await this.confirmPayment(Math.abs(t.total), false);
        this.printLastTicket();
    },

    openPaymentModal() {
        if (!this.cart.length) return;
        const t = this.getTotals();
        this.pmTendered = 0;
        this.pmBuffer = '0';
        const isRefund = t.total < 0;
        const absTotal = Math.abs(t.total);
        const titleEl = document.querySelector('#paymentModal h2');
        if (titleEl) titleEl.textContent = isRefund ? '↩️ Remboursement' : '💳 Paiement';
        document.getElementById('pmTotalToPay').textContent = absTotal.toFixed(2) + ' DH';

        const btnVirement = document.getElementById('btnPmVirement');
        if (btnVirement) btnVirement.style.display = state.params.paiement_virement === '0' ? 'none' : 'block';

        const btnCheque = document.getElementById('btnPmCheque');
        if (btnCheque) btnCheque.style.display = state.params.paiement_cheque === '0' ? 'none' : 'block';

        // ARDOISE: visible seulement si client sélectionné
        const btnCredit = document.getElementById('btnPmCredit');
        const creditInfo = document.getElementById('pmCreditInfo');
        const creditText = document.getElementById('pmCreditInfoText');
        const hasClient = !!this.selectedClient;
        if (btnCredit) btnCredit.style.display = (hasClient && !isRefund) ? '' : 'none';
        if (hasClient && !isRefund && creditInfo && creditText) {
            api(`/clients/${this.selectedClient.id}/credits`).then(data => {
                const solde = data.solde || 0;
                const max = data.credit_max || 500;
                const disponible = max - solde;
                creditInfo.style.display = 'block';
                creditText.innerHTML = `📒 Ardoise <strong>${this.selectedClient.nom}</strong>: 
                    <span style="color:${solde > 0 ? '#e74c3c' : '#27ae60'}">${solde.toFixed(2)} DH dû</span> — 
                    Disponible: <strong>${disponible.toFixed(2)} DH</strong>`;
            }).catch(() => { if (creditInfo) creditInfo.style.display = 'none'; });
        } else {
            if (creditInfo) creditInfo.style.display = 'none';
        }

        // Réinitialiser panneau mixte
        const mixtePanel = document.getElementById('pmMixtePanel');
        if (mixtePanel) mixtePanel.style.display = 'none';
        const esp = document.getElementById('pmMixteEspeces');
        const carte = document.getElementById('pmMixteCarte');
        if (esp) esp.value = '0';
        if (carte) carte.value = '0';

        this.pmUpdateDisplay();
        document.getElementById('paymentModal').style.display = 'flex';
    },

    pmNumpad(val) {
        if (val === 'C') { this.pmBuffer = '0'; }
        else if (val === '.') { if (!this.pmBuffer.includes('.')) this.pmBuffer += '.'; }
        else { if (this.pmBuffer === '0') this.pmBuffer = val; else this.pmBuffer += val; }
        this.pmTendered = parseFloat(this.pmBuffer);
        this.pmUpdateDisplay();
    },

    pmFastCash(amount) {
        this.pmTendered += amount;
        this.pmBuffer = this.pmTendered.toString();
        this.pmUpdateDisplay();
    },

    pmUpdateDisplay() {
        document.getElementById('pmTenderDisplay').textContent = this.pmTendered.toFixed(2);
        const t = this.getTotals();
        const absTotal = Math.abs(t.total);
        const change = this.pmTendered - absTotal;
        const changeEl = document.getElementById('pmChangeDisplay');
        if (change >= 0) {
            changeEl.style.display = 'block';
            document.getElementById('pmChangeAmount').textContent = change.toFixed(2) + ' DH';
        } else { changeEl.style.display = 'none'; }
    },

    hideChangeSection() {
        const el = document.getElementById('pmChangeDisplay');
        if (el) el.style.display = 'none';
    },

    async pmValidate(mode) {
        this.currentPaymentMode = mode;
        const t = this.getTotals();
        const absTotal = Math.abs(t.total);
        let amountToProcess = this.pmTendered;

        if (mode === 'credit') {
            // Paiement sur Ardoise: vérifier client + limite
            if (!this.selectedClient) {
                UI.toast('Veuillez sélectionner un client pour payer à crédit', 'error');
                return;
            }
            try {
                const creditData = await api(`/clients/${this.selectedClient.id}/credits`);
                const solde = creditData.solde || 0;
                const max = creditData.credit_max || 500;
                const disponible = max - solde;
                if (absTotal > disponible) {
                    const ok = await UI.confirmDialog(
                        'Crédit insuffisant',
                        `Limite: ${max} DH | Utilisé: ${solde.toFixed(2)} DH | Disponible: ${disponible.toFixed(2)} DH\nCette commande (${absTotal.toFixed(2)} DH) dépasse la limite.`,
                        { icon: '\u26a0\ufe0f', danger: true }
                    );
                    if (!ok) return;
                }
                amountToProcess = absTotal; // Sur ardoise = total commande
            } catch (e) {
                UI.toast('Impossible de vérifier le crédit: ' + e.message, 'error');
                return;
            }
        } else if (mode === 'mixte') {
            const especes = parseFloat(document.getElementById('pmMixteEspeces').value) || 0;
            const carte = parseFloat(document.getElementById('pmMixteCarte').value) || 0;
            const total = especes + carte;
            if (total < absTotal - 0.01) {
                UI.toast(`Total mixte (${total.toFixed(2)} DH) inférieur au total à payer (${absTotal.toFixed(2)} DH)`, 'error');
                return;
            }
            this._mixteEspeces = especes;
            this._mixteCarte = carte;
            amountToProcess = total;
        } else if (mode === 'especes' && t.total > 0) {
            if (this.pmTendered < absTotal) { UI.toast('Montant insuffisant !', 'warning'); return; }
        } else if (mode === 'especes' && t.total < 0) {
            if (amountToProcess === 0) amountToProcess = absTotal;
        } else {
            if (amountToProcess === 0) amountToProcess = absTotal;
        }
        const genFacture = document.getElementById('pmGenerateFacture')?.checked || false;
        APP.closeModal('paymentModal');
        await this.confirmPayment(amountToProcess, genFacture);
    },

    openMixtePanel() {
        const panel = document.getElementById('pmMixtePanel');
        if (!panel) return;
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            const t = this.getTotals();
            const absTotal = Math.abs(t.total);
            const esp = document.getElementById('pmMixteEspeces');
            const carte = document.getElementById('pmMixteCarte');
            if (esp) esp.value = absTotal.toFixed(2);
            if (carte) carte.value = '0';
            this.updateMixteRest();
            if (esp) esp.select();
        }
    },

    updateMixteRest() {
        const t = this.getTotals();
        const absTotal = Math.abs(t.total);
        const especes = parseFloat(document.getElementById('pmMixteEspeces')?.value) || 0;
        const carte = parseFloat(document.getElementById('pmMixteCarte')?.value) || 0;
        const rest = absTotal - especes - carte;
        const restEl = document.getElementById('pmMixteRest');
        if (restEl) {
            if (rest > 0.01) {
                restEl.textContent = `Reste: ${rest.toFixed(2)} DH`;
                restEl.style.color = 'var(--danger)';
            } else if (rest < -0.01) {
                restEl.textContent = `Monnaie: ${Math.abs(rest).toFixed(2)} DH`;
                restEl.style.color = 'var(--success)';
            } else {
                restEl.textContent = '\u2705 Montant exact';
                restEl.style.color = 'var(--success)';
            }
        }
    },

    async confirmPayment(amountOverride = null, generateFacture = false) {
        if (!this.cart.length) return;
        const t = this.getTotals();
        let mRecu = amountOverride !== null ? amountOverride : Math.abs(t.total);
        if (t.total < 0) mRecu = -Math.abs(mRecu);

        const payload = {
            lignes: this.cart.map(i => ({ produit_id: i.produit_id, quantite: i.quantite, type_tarif: i.type_tarif })),
            mode_paiement: this.currentPaymentMode,
            type_commande: this.orderType,
            client_id: this.selectedClient ? this.selectedClient.id : null,
            client_nom: this.selectedClient ? this.selectedClient.nom : (this.deliveryInfo ? this.deliveryInfo.nom : ''),
            client_telephone: this.selectedClient ? (this.selectedClient.telephone || '') : (this.deliveryInfo ? this.deliveryInfo.telephone : ''),
            montant_recu: mRecu,
            remise_montant: t.remise,
            remise_type: this.discount ? this.discount.type : '',
            notes: '',
            type_tarif: this.currentTarif,
            pourboire: this.currentTip || 0,
            generate_facture: generateFacture
        };

        if (this.currentPaymentMode === 'mixte') {
            payload.montant_especes = this._mixteEspeces || 0;
            payload.montant_carte = this._mixteCarte || 0;
            payload.montant_recu = t.total;
        } else if (this.currentPaymentMode === 'credit') {
            // Paiement intégral sur ardoise: montant_recu = 0, le backend enregistre la dette
            payload.montant_recu = 0;
        }

        try {
            const result = await api('/commandes', { method: 'POST', body: payload });

            if (this.orderType === 'livraison' && this.deliveryInfo) {
                try {
                    await api('/livraisons', { method: 'POST', body: { commande_id: result.id, adresse: this.deliveryInfo.adresse, telephone: this.deliveryInfo.telephone, frais_livraison: this.deliveryInfo.frais, notes: this.deliveryInfo.notes || '' } });
                } catch (e) { console.error('Erreur création livraison:', e); UI.toast('Commande créée mais erreur info livraison', 'warning'); }
            }

            this.lastOrder = { ...result, mode_paiement: this.currentPaymentMode, montant_recu: mRecu, numero_facture: result.numero_facture };

            const reprintBtn = document.getElementById('btnReprint');
            if (reprintBtn) reprintBtn.style.display = 'inline-flex';

            try {
                let recents = JSON.parse(localStorage.getItem('pos_recent_orders') || '[]');
                recents.unshift({ id: result.id, numero: result.numero, total: result.total, date: new Date().toISOString(), client_nom: result.client_nom });
                if (recents.length > 5) recents.pop();
                localStorage.setItem('pos_recent_orders', JSON.stringify(recents));
            } catch (e) { }

            beepSuccess();

            this.hideChangeSection();
            this.cart = []; this.discount = null; this.selectedClient = null; this.currentTip = 0;
            this.deliveryInfo = null; this.orderType = 'emporter';
            const cc = document.getElementById('cartClient'); if (cc) cc.style.display = 'none';
            const rr = document.getElementById('remiseRow'); if (rr) rr.style.display = 'none';
            this.renderCart();
            this.loadProducts().then(() => this.renderProducts());
            APP.checkStockAlerts();

            const modeLabel = this.currentPaymentMode === 'especes' ? '💵 Espèces' :
                this.currentPaymentMode === 'mixte' ? '🔀 Mixte' :
                    this.currentPaymentMode === 'cheque' ? '🏦 Chèque' :
                        this.currentPaymentMode === 'virement' ? '📲 Virement' :
                            this.currentPaymentMode === 'credit' ? '📒 Ardoise (Crédit Client)' : '💳 Carte';
            document.getElementById('successDetails').innerHTML = `
        <p><strong>${result.numero}</strong></p>
        <p>HT: ${result.sous_total.toFixed(2)} DH | TVA: ${result.total_tva.toFixed(2)} DH</p>
        ${result.remise > 0 ? `<p>Remise: -${result.remise.toFixed(2)} DH</p>` : ''}
        <p><strong>Total: ${result.total.toFixed(2)} DH</strong> — ${modeLabel}</p>
        ${result.monnaie_rendue > 0 ? `<p>Monnaie: ${result.monnaie_rendue.toFixed(2)} DH</p>` : ''}
        ${result.points_gagnes ? `<p>⭐ +${result.points_gagnes} points fidélité</p>` : ''}
        ${this.orderType === 'livraison' ? '<p class="text-info mt-8">📦 Livraison enregistrée</p>' : ''}
      `;
            document.getElementById('successModal').style.display = 'flex';
            setTimeout(() => {
                const el = document.getElementById('searchInput');
                if (el) el.focus();
            }, 300);
        } catch (err) {
            beepError();
            UI.toast('Erreur: ' + err.message, 'error');
        }
    },

    showRecentOrders() {
        let recents = [];
        try { recents = JSON.parse(localStorage.getItem('pos_recent_orders') || '[]'); } catch (e) { }
        const list = document.getElementById('recentOrdersList');
        if (!list) return;
        if (recents.length === 0) {
            list.innerHTML = '<div class="text-muted text-center p-20">Aucune commande récente enregistrée</div>';
        } else {
            list.innerHTML = recents.map(o => `
            <div class="cart-item" style="flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;width:100%">
                    <strong>${o.numero}</strong>
                    <span class="badge badge-info">${new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="display:flex;justify-content:space-between;width:100%;color:var(--text-muted);font-size:0.9rem">
                    <span>${o.client_nom || 'Client Externe'}</span>
                    <strong>${o.total.toFixed(2)} DH</strong>
                </div>
                <button class="btn btn-sm btn-outline btn-block" style="width:100%;margin-top:8px" onclick="POS.printTicket(${o.id})">🖨️ Imprimer</button>
            </div>`).join('');
        }
        document.getElementById('recentOrdersModal').style.display = 'flex';
    },

    async parkOrder() {
        if (!this.cart.length) { UI.toast('Panier vide', 'warning'); return; }
        const note = await APP.prompt('Mettre en attente', 'Note pour retrouver la commande (Nom client, etc.) :');
        if (note === null) return;
        const t = this.getTotals();
        const payload = { lignes: this.cart.map(i => ({ produit_id: i.produit_id, quantite: i.quantite, type_tarif: i.type_tarif, notes: '' })), mode_paiement: 'attente', type_commande: this.orderType, client_id: this.selectedClient ? this.selectedClient.id : null, client_nom: this.selectedClient ? this.selectedClient.nom : '', montant_recu: 0, remise_montant: t.remise, remise_type: this.discount ? this.discount.type : '', notes: note || 'Commande en attente', type_tarif: this.currentTarif, statut: 'attente' };
        try {
            await api('/commandes', { method: 'POST', body: payload });
            UI.toast('⏳ Commande mise en attente', 'success');
            this.clearCart();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async showParkedOrders() {
        UI.viewLoading('parkedOrdersList');
        document.getElementById('parkedOrdersModal').style.display = 'flex';
        try {
            const orders = await api('/commandes?statut=attente');
            const list = document.getElementById('parkedOrdersList');
            if (!orders.length) { list.innerHTML = '<div class="text-muted text-center p-20">Aucune commande en attente</div>'; return; }
            list.innerHTML = orders.map(o => `
        <div class="cart-item" style="flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;width:100%">
            <strong>${o.notes || 'Sans note'}</strong>
            <span class="badge badge-warning">${new Date(o.date_creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="display:flex;justify-content:space-between;width:100%;color:var(--text-muted);font-size:0.9rem">
            <span>${o.numero} · ${o.client_nom || 'Client Inconnu'}</span>
            <strong>${o.total.toFixed(2)} DH</strong>
          </div>
          <button class="btn btn-sm btn-primary btn-block" onclick="POS.resumeOrder(${o.id})">📂 Reprendre</button>
        </div>
      `).join('');
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); APP.closeModal('parkedOrdersModal'); }
    },

    async resumeOrder(id) {
        try {
            const order = await api(`/commandes/${id}`);
            if (!order) throw new Error('Commande introuvable');
            if (this.cart.length > 0) { const ok = await UI.confirmDialog('Panier non vide', 'Voulez-vous écraser le panier actuel ?'); if (!ok) return; }
            this.clearCart();
            this.cart = order.lignes.map(l => ({ produit_id: l.produit_id, nom: l.nom_produit || l.produit_nom, prix_ht: l.prix_unitaire_ht, prix_ttc: l.prix_unitaire_ttc, taux_tva: l.taux_tva, quantite: l.quantite, sous_total_ht: l.sous_total_ht, sous_total_ttc: l.sous_total_ttc, montant_tva: l.montant_tva }));
            if (order.client_id) { this.selectedClient = { id: order.client_id, nom: order.client_nom, points: 0 }; const cc = document.getElementById('cartClient'); if (cc) { cc.style.display = 'flex'; document.getElementById('cartClientName').textContent = order.client_nom; } }
            this.renderCart();
            await api(`/commandes/${id}/annuler`, { method: 'PUT' });
            APP.closeModal('parkedOrdersModal');
            UI.toast('Commande reprise', 'success');
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async loadOrderForReturn(id) {
        try {
            const order = await api(`/commandes/${id}`);
            if (!order) throw new Error('Commande introuvable');
            if (this.cart.length > 0) { const ok = await UI.confirmDialog('Panier non vide', 'Voulez-vous écraser le panier actuel pour traiter ce retour ?'); if (!ok) return; }
            this.clearCart();
            APP.switchView('pos');
            this.orderType = 'retour';
            const sel = document.getElementById('orderType'); if (sel) sel.value = 'retour';
            this.cart = order.lignes.map(l => ({ produit_id: l.produit_id, nom: l.nom_produit || l.produit_nom, prix_ht: l.prix_unitaire_ht, prix_ttc: l.prix_unitaire_ttc, taux_tva: l.taux_tva, quantite: -Math.abs(l.quantite), sous_total_ht: -Math.abs(l.sous_total_ht), sous_total_ttc: -Math.abs(l.sous_total_ttc), montant_tva: -Math.abs(l.montant_tva), type_tarif: l.type_tarif || 'particulier' }));
            if (order.client_id) { this.selectedClient = { id: order.client_id, nom: order.client_nom, points: 0 }; const cc = document.getElementById('cartClient'); if (cc) { cc.style.display = 'flex'; document.getElementById('cartClientName').textContent = order.client_nom; } }
            this.renderCart();
            UI.toast('Mode Retour activé pour la commande #' + order.numero, 'info');
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },
};
