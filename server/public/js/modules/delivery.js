import { api } from '../core/api.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

export const LIVRAISON = {
    data: [],

    async load() {
        UI.viewLoading('livraisonBody');
        try {
            const statut = document.getElementById('livraisonStatut').value;
            const query = statut ? `?statut=${statut}` : '';
            this.data = await api('/livraisons' + query);
            this.render();
        } catch (e) {
            UI.toast('Erreur: ' + e.message, 'error');
        }
    },

    render() {
        const body = document.getElementById('livraisonBody');
        if (!body) return;

        if (!this.data.length) {
            body.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">Aucune livraison</div>';
            return;
        }

        body.innerHTML = `<div class="table-responsive"><table class="data-table">
        <thead><tr><th>Commande</th><th>Adresse</th><th>Zone</th><th>Tel</th><th>Frais</th><th>Total</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          ${this.data.map(l => `<tr>
            <td>${l.commande_numero || '-'}</td>
            <td>${l.adresse || '-'}</td>
            <td>${l.zone || '-'}</td>
            <td>${l.telephone || '-'}</td>
            <td>${l.frais_livraison?.toFixed(2) || '0.00'} DH</td>
            <td>${((l.commande_total || 0) + (l.frais_livraison || 0)).toFixed(2)} DH</td>
            <td><span class="badge badge-${l.statut === 'livree' ? 'success' : l.statut === 'en_cours' ? 'warning' : 'info'}">${l.statut}</span></td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" onclick="LIVRAISON.updateStatut(${l.id}, 'en_cours')">🚗 En cours</button>
              <button class="btn btn-sm btn-success" onclick="LIVRAISON.updateStatut(${l.id}, 'livree')">✓ Livrée</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    },

    async updateStatut(id, statut) {
        try {
            await api(`/livraisons/${id}/statut`, { method: 'PUT', body: { statut } });
            UI.toast('Statut mis à jour', 'success');
            this.load();
        } catch (e) {
            UI.toast('Erreur: ' + e.message, 'error');
        }
    },
};

window.LIVRAISON = LIVRAISON;
