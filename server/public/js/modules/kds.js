/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Module KDS (Kitchen Display System)
 *  Affichage en temps réel des commandes envoyées en cuisine.
 * ═══════════════════════════════════════════════════════════════
 */
import { api } from '../core/api.js';
import * as UI from '../core/ui.js';

export const KDS = {
  _refreshTimer: null,
  _AUTO_REFRESH_MS: 15000,

  async load() {
    UI.viewLoading('kdsBody');
    clearInterval(this._refreshTimer);
    try {
      const commandes = await api('/cuisine/commandes-actives');
      this.render(commandes);
      this._refreshTimer = setInterval(() => this.load(), this._AUTO_REFRESH_MS);
    } catch (e) {
      const body = document.getElementById('kdsBody');
      if (body) body.innerHTML = `<p class="text-muted" style="padding:24px">Erreur : ${e.message}</p>`;
    }
  },

  destroy() {
    clearInterval(this._refreshTimer);
    this._refreshTimer = null;
  },

  render(commandes) {
    const body = document.getElementById('kdsBody');
    if (!body) return;

    if (!commandes || commandes.length === 0) {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#aaa;gap:16px;padding-top:60px">
          <span style="font-size:4rem">🍽️</span>
          <p style="font-size:1.2rem">Aucune commande en cours en cuisine</p>
          <button class="btn btn-outline btn-sm" onclick="KDS.load()">🔄 Actualiser</button>
        </div>`;
      return;
    }

    const COURS_LABELS = { entree: '🥗 Entrée', plat: '🍽️ Plat', dessert: '🍰 Dessert', boisson: '🥤 Boisson' };
    const STATUT_COLORS = { envoyee_cuisine: '#f59e0b', servie: '#10b981' };

    body.innerHTML = `
      <div class="kds-toolbar" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface)">
        <span style="font-weight:700;font-size:1rem">📺 KDS — ${commandes.length} commande${commandes.length > 1 ? 's' : ''} active${commandes.length > 1 ? 's' : ''}</span>
        <button class="btn btn-sm btn-outline" onclick="KDS.load()">🔄 Actualiser</button>
        <span class="text-muted" style="margin-left:auto;font-size:12px">Rafraîchissement auto toutes les ${this._AUTO_REFRESH_MS / 1000}s</span>
      </div>
      <div class="kds-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;padding:16px;overflow-y:auto">
        ${commandes.map(cmd => this.renderCard(cmd, COURS_LABELS, STATUT_COLORS)).join('')}
      </div>`;
  },

  renderCard(cmd, COURS_LABELS, STATUT_COLORS) {
    const elapsed = Math.floor((Date.now() - new Date(cmd.created_at).getTime()) / 60000);
    const urgentClass = elapsed >= 15 ? 'style="border-color:#ef4444;background:#fff5f5"' : elapsed >= 8 ? 'style="border-color:#f59e0b"' : '';
    const lignesHtml = Object.entries(cmd.lignes_par_cours)
      .filter(([, items]) => items.length > 0)
      .map(([cours, items]) => `
        <div style="margin-bottom:10px">
          <div style="font-weight:600;font-size:12px;color:#666;text-transform:uppercase;margin-bottom:4px">${COURS_LABELS[cours] || cours}</div>
          ${items.map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:${l.statut_ligne === 'preparee' ? '#f0fff4' : '#fff'};border-radius:4px;border:1px solid ${l.statut_ligne === 'preparee' ? '#a3d9b1' : '#eee'};margin-bottom:3px">
              <span style="${l.statut_ligne === 'preparee' ? 'text-decoration:line-through;color:#999' : ''}">
                <strong>${l.qte}×</strong> ${l.produit_nom}
                ${l.commentaire ? `<em style="font-size:11px;color:#f59e0b;display:block">💬 ${l.commentaire}</em>` : ''}
              </span>
              <button class="btn btn-sm ${l.statut_ligne === 'preparee' ? 'btn-outline' : 'btn-success'}"
                style="padding:2px 8px;font-size:12px"
                onclick="KDS.toggleLigne(${l.id}, '${l.statut_ligne}')">
                ${l.statut_ligne === 'preparee' ? '↩️' : '✅'}
              </button>
            </div>`).join('')}
        </div>`).join('');

    return `
      <div class="card kds-card" ${urgentClass} style="border:2px solid var(--border);position:relative">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <span style="font-size:1.2rem;font-weight:800">#${cmd.numero}</span>
            ${cmd.table_numero ? `<span class="badge" style="margin-left:6px">Table ${cmd.table_numero}</span>` : ''}
          </div>
          <div style="text-align:right">
            <span style="font-size:12px;color:${elapsed >= 15 ? '#ef4444' : elapsed >= 8 ? '#f59e0b' : '#888'};font-weight:600">
              ⏱️ ${elapsed}min
            </span>
            <div style="font-size:11px;color:#aaa">${new Date(cmd.created_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        ${lignesHtml || '<p class="text-muted" style="font-size:13px">Toutes les lignes sont prêtes ✅</p>'}
        <div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
          <button class="btn btn-success btn-sm" style="flex:1" onclick="KDS.marquerPrete(${cmd.id})">✅ Prête</button>
          <button class="btn btn-outline btn-sm" onclick="KDS.load()">🔄</button>
        </div>
      </div>`;
  },

  async toggleLigne(ligneId, currentStatut) {
    const newStatut = currentStatut === 'preparee' ? 'en_attente' : 'preparee';
    try {
      await api(`/cuisine/lignes/${ligneId}/statut`, { method: 'PATCH', body: { statut: newStatut } });
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async marquerPrete(commandeId) {
    try {
      await api(`/cuisine/commandes-actives`, { method: 'GET' }).then(() => { });
      // Marquer toutes les lignes de cette commande comme préparées
      const commandes = await api('/cuisine/commandes-actives');
      const cmd = commandes.find(c => c.id === commandeId);
      if (!cmd) return;

      const allLignes = Object.values(cmd.lignes_par_cours).flat();
      await Promise.all(
        allLignes
          .filter(l => l.statut_ligne !== 'preparee')
          .map(l => api(`/cuisine/lignes/${l.id}/statut`, { method: 'PATCH', body: { statut: 'preparee' } }))
      );
      UI.toast('✅ Commande marquée prête', 'success');
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },
};
