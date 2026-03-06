import { api, API } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';
import { POS } from './pos.js';
import { HISTORY } from './history.js';

export const CLIENTS = {
    data: [],
    async load() {
        UI.viewLoading('clientsBody');
        try {
            this.data = await api('/clients');
            this.render();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    render(list) {
        const items = list || this.data;
        const body = document.getElementById('clientsBody');
        if (!items.length) { body.innerHTML = '<p class="text-center text-muted p-16">Aucun client</p>'; return; }
        body.innerHTML = `<div class="table-responsive"><table class="data-table">
      <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Points</th><th>Solde Crédit</th><th>Achats</th><th>Visites</th><th>Actions</th></tr></thead>
      <tbody>${items.map(c => `<tr>
        <td><strong>${c.nom}</strong></td>
        <td>${c.telephone || '—'}</td>
        <td>${c.email || '—'}</td>
        <td><strong>${c.points_fidelite}</strong> pts</td>
        <td style="color:${c.solde_credit > 0 ? 'var(--danger)' : 'var(--success)'}"><strong>${(c.solde_credit || 0).toFixed(2)} DH</strong></td>
        <td>${(c.total_achats || 0).toFixed(2)} DH</td>
        <td>${c.nb_visites || 0}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="CLIENTS.edit(${c.id})" title="Modifier">✏️</button>
          ${c.solde_credit > 0 ? `<button class="btn btn-sm btn-success" onclick="CLIENTS.settleCredit(${c.id}, '${c.nom}', ${c.solde_credit})" title="Régler Dette">💰</button>` : ''}
          <button class="btn btn-sm btn-outline" onclick="CLIENTS.exportReleve(${c.id})" title="Exporter Relevé">📄</button>
          <button class="btn btn-sm btn-info" onclick="CLIENTS.viewHistory(${c.id})" title="Historique">📜</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
    },

    search(val) {
        if (!val) { this.render(); return; }
        const l = val.toLowerCase();
        this.render(this.data.filter(c => c.nom.toLowerCase().includes(l) || (c.telephone || '').includes(l)));
    },

    viewHistory(clientId) {
        APP.switchView('history');
        window.__histClientId = clientId;
        HISTORY.loadWithClient(clientId);
    },

    async settleCredit(id, nom, solde) {
        const amount = await APP.prompt(`Règlement de dette : ${nom}`, `Dette actuelle : ${solde.toFixed(2)} DH. Entrez le montant payé :`, { type: 'number', defaultValue: solde });
        if (!amount || isNaN(amount) || amount <= 0) return;

        try {
            await api(`/clients/${id}/regler-credit`, { method: 'POST', body: { montant: parseFloat(amount) } });
            UI.toast('✅ Règlement enregistré', 'success');
            this.load();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    exportReleve(id) {
        const url = `${API}/clients/${id}/releve/pdf?token=${state.token}`;
        window.open(url, '_blank');
    },
    async showAddCredit() {
        const id = await APP.prompt('ID du client :');
        if (!id) return;
        const montant = parseFloat(await APP.prompt('Montant du crédit (DH) :'));
        if (isNaN(montant) || montant <= 0) return UI.toast('Montant invalide', 'error');
        try {
            await api(`/clients/${id}/credits`, {
                method: 'POST',
                body: { montant, type: 'debit', description: 'Crédit manuel' }
            });
            UI.toast('Crédit ajouté', 'success');
            this.load();
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    openForm(client = null) {
        document.getElementById('clientFormId').value = client ? client.id : '';
        document.getElementById('clientFormNom').value = client ? client.nom : '';
        document.getElementById('clientFormTel').value = client ? client.telephone || '' : '';
        document.getElementById('clientFormEmail').value = client ? client.email || '' : '';
        document.getElementById('clientFormAdresse').value = client ? client.adresse || '' : '';
        document.getElementById('clientFormNotes').value = client ? client.notes || '' : '';
        document.getElementById('clientFormTarif').value = client ? client.type_tarif || 'particulier' : 'particulier';
        document.getElementById('clientFormTitle').textContent = client ? '✏️ Modifier Client' : '👤 Nouveau Client';
        document.getElementById('clientFormModal').style.display = 'flex';
    },

    edit(id) {
        const c = this.data.find(x => x.id === id);
        if (c) this.openForm(c);
    },

    async save() {
        const btn = document.getElementById('btnSaveClient');
        const id = document.getElementById('clientFormId').value;
        const body = {
            nom: document.getElementById('clientFormNom').value.trim(),
            telephone: document.getElementById('clientFormTel').value.trim(),
            email: document.getElementById('clientFormEmail').value.trim(),
            adresse: document.getElementById('clientFormAdresse').value.trim(),
            type_tarif: document.getElementById('clientFormTarif').value,
            notes: document.getElementById('clientFormNotes').value.trim()
        };
        if (!body.nom) { UI.toast('Le nom est requis', 'error'); return; }

        if (btn) UI.btnLoading(btn, true);

        try {
            if (id) {
                await api(`/clients/${id}`, { method: 'PUT', body });
                UI.toast('✅ Client modifié', 'success');
            } else {
                const res = await api('/clients', { method: 'POST', body: { ...body, points_fidelite: 0 } });
                UI.toast('✅ Client créé', 'success');
                if (document.getElementById('posClientSearch')) {
                    POS.selectClient(res.id, body.nom, 0);
                    APP.closeModal('clientSearchModal');
                }
            }
            APP.closeModal('clientFormModal');
            this.load();
            if (document.getElementById('view-admin').classList.contains('active')) {
                const btn = document.querySelector('.tab-btn[onclick*="clients"]');
                if (btn) btn.click();
            }
        } catch (e) {
            UI.toast('Erreur: ' + e.message, 'error');
        } finally {
            if (btn) UI.btnLoading(btn, false);
        }
    }
};
