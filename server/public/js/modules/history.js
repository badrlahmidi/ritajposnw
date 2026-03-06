import { api, API } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';
import { POS } from './pos.js';

export const HISTORY = {
    selectedOrders: new Set(),

    loadWithClient(clientId) {
        this.selectedOrders.clear();
        this.load(clientId);
    },

    async load(clientId = null) {
        UI.viewLoading('historyBody');
        const date = document.getElementById('historyDate').value;
        const dateFin = document.getElementById('historyDateFin').value;
        const statut = document.getElementById('historyStatut').value;
        const search = document.getElementById('historySearch').value;

        let url = '/commandes?';
        if (clientId) url += `client_id=${clientId}&`;
        if (date) url += `date_debut=${date}&`;
        if (dateFin) url += `date_fin=${dateFin}&`;
        if (statut) url += `statut=${statut}&`;
        if (search) url += `search=${encodeURIComponent(search)}&`;

        try {
            const commandes = await api(url);
            const body = document.getElementById('historyBody');
            if (!commandes.length) {
                body.innerHTML = '<p class="text-center text-muted p-16">Aucune commande trouvée</p>';
                this.updateSelectionUI();
                return;
            }

            body.innerHTML = `<div class="table-responsive"><table class="data-table">
        <thead><tr>
          <th style="width:40px"><input type="checkbox" onchange="HISTORY.toggleAll(this.checked)"></th>
          <th>N°</th><th>Date</th><th>Type</th><th>Total</th><th>Paiement</th><th>Caissier</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>${commandes.map(c => `<tr>
          <td><input type="checkbox" class="order-checkbox" data-id="${c.id}" ${this.selectedOrders.has(c.id) ? 'checked' : ''} onchange="HISTORY.toggleOrder(${c.id}, this.checked)"></td>
          <td><strong>${c.numero}</strong><br><small class="text-muted">${c.client_nom || ''}</small></td>
          <td>${new Date(c.date_creation).toLocaleString('fr-FR')}</td>
          <td>${c.type_commande === 'emporter' ? '🛍️' : c.type_commande === 'livraison' ? '🚗' : '🏠'}</td>
          <td><strong>${(c.total || 0).toFixed(2)} DH</strong></td>
          <td>${c.mode_paiement === 'especes' ? '💵' : '💳'} ${c.mode_paiement}</td>
          <td>${c.caissier_nom || '—'}</td>
          <td><span class="badge badge-${c.statut === 'payee' ? 'success' : 'danger'}">${c.statut}</span></td>
          <td class="actions">
            <button class="btn btn-sm btn-outline" onclick="HISTORY.detail(${c.id})" title="Détails">👁️</button>
            <button class="btn btn-sm btn-outline" onclick="HISTORY.printReceipt(${c.id})" title="Reçu Thermique">🧾</button>
            ${c.numero_facture
                    ? `<button class="btn btn-sm btn-info" onclick="HISTORY.exportPDF(${c.id})" title="Facture PDF (${c.numero_facture})">📄</button>`
                    : `<button class="btn btn-sm btn-outline" onclick="HISTORY.generateFacture(${c.id})" title="Générer Facture">➕📄</button>`
                }
            ${c.statut === 'payee' ? `<button class="btn btn-sm btn-warning" onclick="POS.loadOrderForReturn(${c.id})" title="Retour / Remboursement">↩️</button>` : ''}
            ${c.statut !== 'annulee' && (state.user.role === 'admin' || state.user.role === 'manager') ? `<button class="btn btn-sm btn-danger" onclick="HISTORY.annuler(${c.id})">✕</button>` : ''}
          </td>
        </tr>`).join('')}</tbody></table></div>`;

            this.updateSelectionUI();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    toggleOrder(id, checked) {
        if (checked) this.selectedOrders.add(id);
        else this.selectedOrders.delete(id);
        this.updateSelectionUI();
    },

    toggleAll(checked) {
        const boxes = document.querySelectorAll('.order-checkbox');
        boxes.forEach(cb => {
            cb.checked = checked;
            const id = parseInt(cb.getAttribute('data-id'));
            if (checked) this.selectedOrders.add(id);
            else this.selectedOrders.delete(id);
        });
        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const btn = document.getElementById('btnBatchInvoice');
        const countSpan = document.getElementById('selectedCount');
        if (this.selectedOrders.size > 0) {
            btn.style.display = 'inline-flex';
            countSpan.textContent = this.selectedOrders.size;
        } else {
            btn.style.display = 'none';
        }
    },

    async generateBatchInvoice() {
        const ids = Array.from(this.selectedOrders);
        if (!ids.length) return;

        const ok = await UI.confirmDialog('Facture Groupée', `Voulez-vous générer une facture regroupant ces ${ids.length} commandes ?`, { icon: '📄' });
        if (!ok) return;

        UI.toast('🚀 Génération de la facture groupée...', 'info');
        try {
            const response = await fetch(`${API}/facture/batch/pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({ ids })
            });

            if (!response.ok) throw new Error('Erreur lors de la génération');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            UI.toast('📄 Facture groupée générée', 'success');
            this.selectedOrders.clear();
            this.updateSelectionUI();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async printReceipt(id) {
        try {
            const cmd = await api(`/commandes/${id}`);
            const originalLastOrder = POS.lastOrder;
            POS.lastOrder = cmd;
            POS.printLastTicket();
            POS.lastOrder = originalLastOrder;
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async generateFacture(id) {
        const ok = await UI.confirmDialog('Générer une facture ?', 'Voulez-vous générer une facture officielle pour cette commande ?', { icon: '📄' });
        if (!ok) return;
        try {
            const res = await api(`/commandes/${id}/facturer`, { method: 'POST' });
            UI.toast('✅ Facture générée : ' + res.numero_facture, 'success');
            this.load();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async detail(id) {
        try {
            const cmd = await api(`/commandes/${id}`);
            document.getElementById('orderDetailBody').innerHTML = `
        <div class="ticket-preview">
          <div class="ticket-header">
            <strong>${state.params.nom_commerce || 'RITAJ SMART POS'}</strong><br>
            <small>${state.params.adresse || ''} | ICE: ${state.params.ice || ''}</small>
          </div>
          <div class="ticket-line"><span>N°</span><span><strong>${cmd.numero}</strong></span></div>
          <div class="ticket-line"><span>Date</span><span>${new Date(cmd.date_creation).toLocaleString('fr-FR')}</span></div>
          <div class="ticket-line"><span>Caissier</span><span>${cmd.caissier_nom || '—'}</span></div>
          ${cmd.client_nom ? `<div class="ticket-line"><span>Client</span><span>${cmd.client_nom}</span></div>` : ''}
      <div class="ticket-sep"></div>
          ${(cmd.lignes || []).map(l => `<div class="ticket-line"><span>${l.nom_produit || l.produit_nom} x${l.quantite}</span><span>${(l.sous_total_ttc || l.sous_total || 0).toFixed(2)}</span></div>`).join('')}
          <div class="ticket-sep"></div>
          <div class="ticket-line"><span>Sous-total HT</span><span>${(cmd.sous_total || 0).toFixed(2)} DH</span></div>
          <div class="ticket-line"><span>TVA</span><span>${(cmd.total_tva || 0).toFixed(2)} DH</span></div>
          ${cmd.remise_montant > 0 ? `<div class="ticket-line"><span>Remise</span><span>-${cmd.remise_montant.toFixed(2)} DH</span></div>` : ''}
          <div class="ticket-sep"></div>
          <div class="ticket-line ticket-total"><span>TOTAL TTC</span><span>${(cmd.total || 0).toFixed(2)} DH</span></div>
          <div class="ticket-sep"></div>
          <div class="ticket-line"><span>Paiement</span><span>${cmd.mode_paiement === 'especes' ? '💵 Espèces' : '💳 Carte'}</span></div>
          ${cmd.monnaie_rendue > 0 ? `<div class="ticket-line"><span>Monnaie</span><span>${cmd.monnaie_rendue.toFixed(2)} DH</span></div>` : ''}
          ${cmd.points_gagnes ? `<div class="ticket-line"><span>Points</span><span>+${cmd.points_gagnes} ⭐</span></div>` : ''}
      <div class="ticket-footer">${state.params.ticket_footer || 'Merci de votre visite !'}</div>
        </div>`;
            document.getElementById('orderDetailModal').style.display = 'flex';
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async annuler(id) {
        const ok = await UI.confirmDialog(
            'Annuler cette commande ?',
            'Le stock sera restauré et les points fidélité retirés. Cette action est irréversible.',
            { icon: '🗑️', confirmText: 'Annuler la commande', danger: true }
        );
        if (!ok) return;
        try {
            await api(`/commandes/${id}/annuler`, { method: 'PUT' });
            UI.toast('✅ Commande annulée', 'success');
            this.load();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    exportPDF(id) {
        const url = `${API}/facture/${id}/pdf`;
        const w = window.open(url + `?token=${state.token}`, '_blank');
        if (!w) {
            fetch(url, { headers: { Authorization: `Bearer ${state.token}` } })
                .then(r => r.blob())
                .then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `facture-${id}.pdf`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                    UI.toast('📄 Facture PDF téléchargée', 'success');
                })
                .catch(e => UI.toast('Erreur export PDF: ' + e.message, 'error'));
        }
    },

    async exportJSON(id) {
        try {
            const data = await api(`/facture/${id}/json`);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `facture-${id}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            UI.toast('📋 Facture JSON téléchargée', 'success');
        } catch (e) { UI.toast('Erreur export JSON: ' + e.message, 'error'); }
    }
};
