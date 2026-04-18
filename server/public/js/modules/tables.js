/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Module Tables / Plan de Salle
 *  Gestion des salles, tables, et occupation en temps réel.
 * ═══════════════════════════════════════════════════════════════
 */
import { api } from '../core/api.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

export const TABLES = {
  _salles: [],

  async load() {
    UI.viewLoading('tablesBody');
    try {
      this._salles = await api('/tables/salles');
      this.render();
    } catch (e) {
      const body = document.getElementById('tablesBody');
      if (body) body.innerHTML = `<p class="text-muted" style="padding:24px">Erreur : ${e.message}</p>`;
    }
  },

  render() {
    const body = document.getElementById('tablesBody');
    if (!body) return;

    if (!this._salles || this._salles.length === 0) {
      body.innerHTML = `
        <div style="text-align:center;padding:48px;color:#aaa">
          <div style="font-size:4rem;margin-bottom:16px">🪑</div>
          <p style="font-size:1.1rem;margin-bottom:16px">Aucune salle configurée</p>
          <button class="btn btn-primary" onclick="TABLES.openSalleForm()">+ Créer une salle</button>
        </div>`;
      return;
    }

    const STATUT = {
      libre:     { label: 'Libre',     color: '#10b981', bg: '#f0fff4' },
      occupee:   { label: 'Occupée',   color: '#ef4444', bg: '#fff5f5' },
      reservee:  { label: 'Réservée',  color: '#f59e0b', bg: '#fffbeb' },
      nettoyage: { label: 'Nettoyage', color: '#6366f1', bg: '#f5f3ff' },
    };

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <span style="font-weight:700">🪑 Plan de Salle</span>
        <button class="btn btn-primary btn-sm" onclick="TABLES.openSalleForm()">+ Salle</button>
        <button class="btn btn-outline btn-sm" onclick="TABLES.openTableForm()">+ Table</button>
        <button class="btn btn-outline btn-sm" onclick="TABLES.load()">🔄 Actualiser</button>
        <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(STATUT).map(([k, v]) =>
            `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:${v.bg};color:${v.color};font-weight:600">${v.label}</span>`
          ).join('')}
        </div>
      </div>
      <div style="padding:16px;overflow-y:auto">
        ${this._salles.map(salle => this.renderSalle(salle, STATUT)).join('')}
      </div>

      <!-- Formulaire Salle -->
      <div id="formSalle" class="modal-overlay" style="display:none;z-index:500;background:rgba(0,0,0,0.5)">
        <div class="card modal" style="max-width:400px;width:90%">
          <h4 id="salleFormTitle" class="mb-12">➕ Nouvelle salle</h4>
          <input type="hidden" id="salleId">
          <div class="form-group mb-12"><label>Nom de la salle</label><input id="salleNom" class="input" placeholder="Salle principale"></div>
          <div class="form-group mb-12"><label>Ordre d'affichage</label><input id="salleOrdre" class="input" type="number" value="0"></div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="TABLES.saveSalle()">💾 Enregistrer</button>
            <button class="btn btn-outline" onclick="TABLES.closeModal('formSalle')">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Formulaire Table -->
      <div id="formTable" class="modal-overlay" style="display:none;z-index:500;background:rgba(0,0,0,0.5)">
        <div class="card modal" style="max-width:440px;width:90%">
          <h4 id="tableFormTitle" class="mb-12">➕ Nouvelle table</h4>
          <input type="hidden" id="tableId">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group"><label>Numéro / Nom</label><input id="tableNumero" class="input" placeholder="1 ou Terrasse-A"></div>
            <div class="form-group"><label>Capacité (couverts)</label><input id="tableCapacite" class="input" type="number" value="4" min="1"></div>
          </div>
          <div class="form-group mb-12"><label>Salle</label>
            <select id="tableSalle" class="input">
              ${this._salles.filter(s => s.id).map(s => `<option value="${s.id}">${s.nom}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="TABLES.saveTable()">💾 Enregistrer</button>
            <button class="btn btn-outline" onclick="TABLES.closeModal('formTable')">Annuler</button>
          </div>
        </div>
      </div>`;
  },

  renderSalle(salle, STATUT) {
    const tables = salle.tables || [];
    const libres = tables.filter(t => t.statut === 'libre' || !t.statut).length;
    return `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <h3 style="margin:0">🏠 ${salle.nom || 'Sans salle'}</h3>
          <span class="text-muted" style="font-size:13px">${libres}/${tables.length} libres</span>
          ${salle.id ? `
            <button class="btn btn-sm btn-outline" style="margin-left:auto" onclick="TABLES.openSalleForm(${salle.id},'${salle.nom.replace(/'/g, "\\'")}',${salle.ordre || 0})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="TABLES.deleteSalle(${salle.id})">🗑️</button>` : ''}
        </div>
        ${tables.length === 0 ? '<p class="text-muted" style="font-size:13px">Aucune table dans cette salle.</p>' : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px">
          ${tables.map(t => {
            const st = STATUT[t.statut] || STATUT.libre;
            return `
            <div class="table-card" style="border:2px solid ${st.color};background:${st.bg};border-radius:10px;padding:12px;text-align:center;cursor:pointer;transition:transform .15s"
              onmouseenter="this.style.transform='scale(1.03)'" onmouseleave="this.style.transform=''"
              onclick="TABLES.tableAction(${t.id},'${t.statut || 'libre'}')">
              <div style="font-size:1.6rem;font-weight:800;line-height:1">${t.numero}</div>
              <div style="font-size:11px;font-weight:600;color:${st.color};margin-top:4px">${st.label}</div>
              <div style="font-size:11px;color:#888">${t.capacite || '?'} couverts</div>
              <div style="display:flex;gap:4px;margin-top:8px;justify-content:center">
                <button class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:11px"
                  onclick="event.stopPropagation();TABLES.openTableForm(${t.id})">✏️</button>
                <button class="btn btn-sm btn-danger" style="padding:2px 6px;font-size:11px"
                  onclick="event.stopPropagation();TABLES.deleteTable(${t.id})">🗑️</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  async tableAction(tableId, currentStatut) {
    const NEXT = { libre: 'occupee', occupee: 'nettoyage', nettoyage: 'libre', reservee: 'occupee' };
    const next = NEXT[currentStatut] || 'libre';
    const labels = { occupee: 'Occupée', libre: 'Libre', nettoyage: 'Nettoyage', reservee: 'Réservée' };
    if (!await UI.confirmDialog('Changer statut', `Passer la table en : ${labels[next]} ?`)) return;
    try {
      await api(`/tables/${tableId}/statut`, { method: 'PATCH', body: { statut: next } });
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  /* ── Formulaires salle ── */
  openSalleForm(id, nom = '', ordre = 0) {
    document.getElementById('salleId').value = id || '';
    document.getElementById('salleNom').value = nom;
    document.getElementById('salleOrdre').value = ordre;
    document.getElementById('salleFormTitle').textContent = id ? '✏️ Modifier la salle' : '➕ Nouvelle salle';
    document.getElementById('formSalle').style.display = 'flex';
  },

  async saveSalle() {
    const id  = document.getElementById('salleId').value;
    const nom = document.getElementById('salleNom').value.trim();
    const ordre = parseInt(document.getElementById('salleOrdre').value) || 0;
    if (!nom) return UI.toast('Le nom est requis', 'error');
    try {
      if (id) await api(`/tables/salles/${id}`, { method: 'PUT', body: { nom, ordre } });
      else    await api('/tables/salles',        { method: 'POST', body: { nom, ordre } });
      UI.toast('✅ Salle enregistrée', 'success');
      this.closeModal('formSalle');
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async deleteSalle(id) {
    if (!await UI.confirmDialog('Supprimer la salle ?', 'Les tables de cette salle seront dissociées.', { danger: true })) return;
    try {
      await api(`/tables/salles/${id}`, { method: 'DELETE' });
      UI.toast('✅ Salle supprimée', 'success');
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  /* ── Formulaires table ── */
  openTableForm(id) {
    document.getElementById('tableId').value = id || '';
    document.getElementById('tableFormTitle').textContent = id ? '✏️ Modifier la table' : '➕ Nouvelle table';
    if (!id) {
      document.getElementById('tableNumero').value = '';
      document.getElementById('tableCapacite').value = '4';
    } else {
      // Chercher les infos de la table dans les salles déjà chargées
      const allTables = this._salles.flatMap(s => s.tables || []);
      const t = allTables.find(x => x.id === id);
      if (t) {
        document.getElementById('tableNumero').value = t.numero;
        document.getElementById('tableCapacite').value = t.capacite || 4;
        if (t.salle_id) document.getElementById('tableSalle').value = t.salle_id;
      }
    }
    document.getElementById('formTable').style.display = 'flex';
  },

  async saveTable() {
    const id       = document.getElementById('tableId').value;
    const numero   = document.getElementById('tableNumero').value.trim();
    const capacite = parseInt(document.getElementById('tableCapacite').value) || 4;
    const salle_id = document.getElementById('tableSalle').value || null;
    if (!numero) return UI.toast('Le numéro/nom est requis', 'error');
    const body = { numero, capacite, salle_id };
    try {
      if (id) await api(`/tables/${id}`,  { method: 'PUT',  body });
      else    await api('/tables',         { method: 'POST', body });
      UI.toast('✅ Table enregistrée', 'success');
      this.closeModal('formTable');
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async deleteTable(id) {
    if (!await UI.confirmDialog('Supprimer la table ?', 'Cette table sera définitivement supprimée.', { danger: true })) return;
    try {
      await api(`/tables/${id}`, { method: 'DELETE' });
      UI.toast('✅ Table supprimée', 'success');
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  },
};
