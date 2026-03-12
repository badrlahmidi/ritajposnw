import { api, API } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

export const STOCK = {
  data: [],
  achatLignes: [],
  achatFournisseurs: [],
  achatProduits: [],

  async openAchatForm() {
    UI.viewLoading('stockBody');
    try {
      this.achatFournisseurs = await api('/fournisseurs');
      this.achatProduits = await api('/produits?all=1');
      this.achatLignes = [];
      this.renderAchatForm();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
      this.load();
    }
  },

  renderAchatForm() {
    const body = document.getElementById('stockBody');
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px; max-width: 900px; margin: 0 auto; padding: 20px; background:var(--bg); border-radius:8px; border:1px solid var(--border)">
        <h3 style="margin:0; border-bottom: 2px solid var(--border-focus); padding-bottom: 10px;">🛒 Nouvel Achat (Réception)</h3>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div class="form-group">
            <label>Fournisseur *</label>
            <select id="achatFournisseur" class="input-full">
              <option value="">-- Choisir un fournisseur --</option>
              ${this.achatFournisseurs.map(f => `<option value="${f.id}">${f.nom}</option>`).join('')}
            </select>
            <small style="display:block;margin-top:4px"><a href="#" onclick="DASHBOARD.goToAdmin(); setInterval(()=>ADMIN.switchTab('parametres'), 500)">+ Créer un fournisseur dans Admin</a></small>
          </div>
          <div class="form-group">
            <label>Référence Facture / BL</label>
            <input type="text" id="achatReference" class="input-full" placeholder="Ex: FAC-2023-0801">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div class="form-group">
            <label>Montant Total Calculé (DH) *</label>
            <input type="number" id="achatTotal" class="input-full" placeholder="0.00" step="0.01" readonly style="background:#f1f3f5; font-weight:bold;">
          </div>
          <div class="form-group">
            <label>Mode de paiement</label>
            <select id="achatPaiement" class="input-full">
              <option value="especes">💵 Espèces</option>
              <option value="virement">📲 Virement</option>
              <option value="cheque">🏦 Chèque</option>
              <option value="credit">⏳ À crédit</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="background:#f8f9fa; padding:15px; border-radius:6px; border:1px solid #ddd">
          <label style="font-weight:bold; color:var(--primary)">Scanner / Chercher produit à ajouter au stock:</label>
          <div style="display:flex; gap:10px; margin-top:8px;">
            <input type="text" id="achatSearchProd" class="input-full" placeholder="Code-barres ou nom court..." onkeydown="if(event.key==='Enter') STOCK.searchAchatProd()">
            <button class="btn btn-outline" onclick="STOCK.searchAchatProd()">Ajouter</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr><th>Produit</th><th style="width:120px">Prix Achat unitaire</th><th style="width:120px">Qté reçue</th><th style="width:120px">Sous-total</th><th style="width:80px">Action</th></tr>
            </thead>
            <tbody id="achatLinesBody">
              <tr><td colspan="5" class="text-center text-muted">Aucun produit...</td></tr>
            </tbody>
          </table>
        </div>

        <div class="form-group">
          <label>Notes / Observations</label>
          <textarea id="achatNotes" class="input-full" placeholder="..." rows="2"></textarea>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:10px;">
          <button class="btn btn-secondary" onclick="STOCK.load()">Annuler</button>
          <button class="btn btn-primary" onclick="STOCK.submitAchat(event)">✅ Valider Réception & Dépense</button>
        </div>
      </div>
    `;
    this.updateAchatLines();
    const sf = document.getElementById('achatSearchProd');
    if (sf) sf.focus();
  },

  searchAchatProd() {
    const term = document.getElementById('achatSearchProd').value.toLowerCase().trim();
    if (!term) return;
    const match = this.achatProduits.find(p => p.code_barre === term || (p.nom && p.nom.toLowerCase().includes(term)));
    if (match) {
      this.addAchatLine(match);
      document.getElementById('achatSearchProd').value = '';
      document.getElementById('achatSearchProd').focus();
    } else {
      UI.toast('Aucun produit trouvé: ' + term, 'warning');
    }
  },

  addAchatLine(prod) {
    const exists = this.achatLignes.find(l => l.produit_id === prod.id);
    if (exists) {
      exists.quantite += 1;
      exists.sous_total = exists.quantite * exists.prix_achat;
    } else {
      const prix_achat = prod.cout_revient || 0;
      this.achatLignes.push({
        produit_id: prod.id,
        nom: prod.nom,
        quantite: 1,
        prix_achat: prix_achat,
        sous_total: prix_achat
      });
    }
    this.updateAchatLines();
  },

  updateAchatLines() {
    const tbody = document.getElementById('achatLinesBody');
    if (!tbody) return;
    if (this.achatLignes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucun produit ajouté pour cette réception</td></tr>';
      document.getElementById('achatTotal').value = '0.00';
      return;
    }

    let total = 0;
    tbody.innerHTML = this.achatLignes.map((l, i) => {
      total += l.sous_total;
      return `
      <tr>
        <td><strong>${l.nom}</strong></td>
        <td>
          <input type="number" class="input-full text-center" style="font-weight:bold" value="${l.prix_achat}" min="0" step="0.01" onchange="STOCK.changeAchatPrice(${i}, this.value)">
        </td>
        <td>
          <input type="number" class="input-full text-center" style="font-weight:bold" value="${l.quantite}" min="1" step="0.1" onchange="STOCK.changeAchatQty(${i}, this.value)">
        </td>
        <td class="text-right" style="font-weight:bold;">${l.sous_total.toFixed(2)} DH</td>
        <td class="actions">
          <button class="btn btn-sm btn-danger" onclick="STOCK.removeAchatLine(${i})">✕</button>
        </td>
      </tr>
    `}).join('');

    document.getElementById('achatTotal').value = total.toFixed(2);
  },

  changeAchatQty(idx, val) {
    const v = parseFloat(val);
    if (v > 0) this.achatLignes[idx].quantite = v;
    else this.achatLignes[idx].quantite = 1;
    this.achatLignes[idx].sous_total = this.achatLignes[idx].quantite * this.achatLignes[idx].prix_achat;
    this.updateAchatLines();
  },

  changeAchatPrice(idx, val) {
    const p = parseFloat(val);
    if (p >= 0) this.achatLignes[idx].prix_achat = p;
    else this.achatLignes[idx].prix_achat = 0;
    this.achatLignes[idx].sous_total = this.achatLignes[idx].quantite * this.achatLignes[idx].prix_achat;
    this.updateAchatLines();
  },

  removeAchatLine(idx) {
    this.achatLignes.splice(idx, 1);
    this.updateAchatLines();
  },

  async submitAchat(event) {
    const fId = document.getElementById('achatFournisseur').value;
    const ref = document.getElementById('achatReference').value.trim();
    const tot = parseFloat(document.getElementById('achatTotal').value);
    const pm = document.getElementById('achatPaiement').value;
    const notes = document.getElementById('achatNotes').value.trim();

    if (!fId) return UI.toast('Veuillez sélectionner un fournisseur', 'error');
    if (!tot || tot <= 0) return UI.toast('Montant total invalide', 'error');
    if (this.achatLignes.length === 0) return UI.toast('Veuillez ajouter au moins un produit', 'error');

    try {
      if (event && event.target) UI.btnLoading(event.target, true, 'Enregistrement...');
      await api('/stock/achat', {
        method: 'POST',
        body: {
          fournisseur_id: fId,
          reference_facture: ref,
          montant_total: tot,
          mode_paiement: pm,
          notes: notes,
          lignes: this.achatLignes
        }
      });
      UI.toast('✅ Achat validé et stock mis à jour !', 'success');
      this.load();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
      if (event && event.target) UI.btnLoading(event.target, false);
    }
  },

  async openQuickInventory() {
    try {
      // Check for active session
      const active = await api('/stock/inventory/active');
      if (active) {
        this.resumeInventory(active);
        return;
      }

      const ok = await UI.confirmDialog('Nouvel Inventaire', 'Démarrer une nouvelle session d\'inventaire ?');
      if (!ok) return;

      const res = await api('/stock/inventory', { method: 'POST', body: { notes: 'Inventaire Manuel' } });
      this.resumeInventory({ id: res.id, lignes: [] });

    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  resumeInventory(session) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'inventoryModal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      < div class= "modal modal-lg" style = "height:90vh;display:flex;flex-direction:column" >
        <div class="modal-header">
          <h2>📦 Session Inventaire #${session.id}</h2>
          <button class="btn btn-icon modal-close" onclick="document.getElementById('inventoryModal').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
          <div class="form-group" style="display:flex;gap:10px">
            <input type="text" id="invScan" class="input-full" placeholder="Scan Code-barres ou ID..." autofocus style="flex:1;font-size:1.2rem;padding:12px">
            <input type="number" id="invQty" class="input-full" value="1" style="width:100px;font-size:1.2rem;text-align:center" title="Quantité à ajouter">
          </div>
          
          <div id="invLastScan" style="margin-bottom:10px;min-height:24px;color:var(--primary);font-weight:bold"></div>

          <div style="flex:1;overflow-y:auto;border:1px solid #eee;border-radius:8px">
            <table class="data-table">
                <thead><tr><th>Produit</th><th>Théorique</th><th>Réel</th><th>Ecart</th></tr></thead>
                <tbody id="invLinesBody"></tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer" style="justify-content:space-between">
            <span class="text-muted">Session active - Modifications non appliquées</span>
            <button class="btn btn-success" onclick="STOCK.commitInventory(${session.id})">✅ Clôturer & Appliquer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    this.renderInventoryLines(session.lignes);

    const input = document.getElementById('invScan');
    const qtyInput = document.getElementById('invQty');

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const q = parseFloat(qtyInput.value) || 1;
        this.scanInventoryItem(session.id, input.value, q);
      }
    };
    input.focus();
  },

  renderInventoryLines(lines) {
    const tbody = document.getElementById('invLinesBody');
    tbody.innerHTML = lines.map(l => {
      const ecart = l.quantite_reelle - l.quantite_theorique;
      const cls = ecart > 0 ? 'text-success' : ecart < 0 ? 'text-danger' : 'text-muted';
      return `< tr >
                <td>${l.nom} <small class="text-muted">(${l.code_barre || '#' + l.produit_id})</small></td>
                <td>${l.quantite_theorique}</td>
                <td style="font-weight:bold">${l.quantite_reelle}</td>
                <td class="${cls}">${ecart > 0 ? '+' : ''}${ecart}</td>
            </tr > `;
    }).join('');
  },

  async scanInventoryItem(sessionId, code, qty) {
    if (!code) return;
    try {
      const res = await api(`/ stock / inventory / ${sessionId}/scan`, { method: 'POST', body: { code_barre: code, quantite: qty } });

      document.getElementById('invLastScan').textContent = `✅ ${res.nom} : ${res.prev} -> ${qty}`;
      document.getElementById('invScan').value = '';
      document.getElementById('invQty').value = '1';

      // Refresh lines
      const updated = await api('/stock/inventory/active');
      this.renderInventoryLines(updated.lignes);

    } catch (e) {
      document.getElementById('invLastScan').innerHTML = `<span class="text-danger">❌ ${e.message}</span>`;
      document.getElementById('invScan').select();
    }
  },

  async commitInventory(id) {
    if (!await UI.confirmDialog('Clôturer l\'inventaire ?', 'Ceci va mettre à jour les stocks de tous les produits scannés. Cette action est irréversible.')) return;

    try {
      await api(`/stock/inventory/${id}/commit`, { method: 'POST' });
      UI.toast('✅ Inventaire validé et stock mis à jour', 'success');
      document.getElementById('inventoryModal').remove();
      this.load();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async load() {
    UI.viewLoading('stockBody');
    try {
      this.data = await api('/stock');
      this.render();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  render(list) {
    const items = list || this.data;
    const body = document.getElementById('stockBody');
    body.innerHTML = `<div class="table-responsive"><table class="data-table">
      <thead><tr><th>Produit</th><th>Catégorie</th><th>Prix TTC</th><th>Quantité</th><th>Seuil</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>${items.map(s => {
      const isLow = s.quantite <= s.seuil_alerte;
      return `<tr>
          <td><strong>${s.produit_nom}</strong></td>
          <td><span class="badge" style="background:${s.categorie_couleur}22;color:${s.categorie_couleur}">${s.categorie_nom || '—'}</span></td>
          <td>${(s.prix_ttc || 0).toFixed(2)} DH</td>
          <td><strong style="color:${isLow ? 'var(--danger)' : 'var(--success)'}">${s.quantite}</strong></td>
          <td>${s.seuil_alerte}</td>
          <td>${isLow ? '<span class="badge badge-danger">⚠️ Bas</span>' : '<span class="badge badge-success">✅ OK</span>'}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="STOCK.openAdjust(${s.produit_id}, '${s.produit_nom.replace(/'/g, "\\'")}', ${s.quantite})" style="margin-right:2px">Ajuster</button>
            <button class="btn btn-sm btn-danger" onclick="STOCK.openPerte(${s.produit_id}, '${s.produit_nom.replace(/'/g, "\\'")}', ${s.quantite})" title="Déclarer une perte/casse">💥 Perte</button>
          </td>
        </tr>`;
    }).join('')}</tbody></table></div>`;
  },

  async showAlertes() {
    try {
      const alertes = await api('/stock/alertes');
      this.render(alertes);
      UI.toast(`⚠️ ${alertes.length} produit(s) en alerte`, alertes.length ? 'error' : 'success');
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async showAlertesDLC() {
    try {
      const alertes = await api('/produits/dlc/alertes?jours=7');
      const body = document.getElementById('stockBody');
      if (!alertes.length) {
        body.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">Aucun produit proche de la péremption (7 jours)</div>';
        return;
      }
      body.innerHTML = `<div class="table-responsive"><table class="data-table">
        <thead><tr><th>Produit</th><th>Catégorie</th><th>DLC</th><th>Jours restants</th><th>Prix TTC</th></tr></thead>
        <tbody>${alertes.map(p => {
        const jours = parseInt(p.jours_restants);
        const danger = jours <= 3;
        return `<tr style="background:${danger ? 'rgba(231,76,60,0.08)' : ''}">
            <td><strong>${p.nom}</strong></td>
            <td>${p.categorie_nom || '—'}</td>
            <td style="color:${danger ? 'var(--danger)' : 'var(--text)'}">${p.dlc || '—'}</td>
            <td style="font-weight:700;color:${danger ? 'var(--danger)' : jours <= 7 ? 'var(--warning)' : 'var(--success)'}">${jours} j</td>
            <td>${(p.prix_ttc || 0).toFixed(2)} DH</td>
          </tr>`;
      }).join('')}</tbody></table></div>`;
      UI.toast(`⚠️ ${alertes.length} produit(s) proche de la péremption`, 'warning');
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async showMouvements() {
    try {
      const mvts = await api('/stock/mouvements');
      const body = document.getElementById('stockBody');
      body.innerHTML = `<div class="table-responsive"><table class="data-table">
        <thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Qté</th><th>Avant</th><th>Après</th><th>Motif</th><th>Par</th></tr></thead>
        <tbody>${mvts.map(m => `<tr>
          <td>${new Date(m.date_mouvement).toLocaleString('fr-FR')}</td>
          <td>${m.produit_nom || '—'}</td>
          <td><span class="badge badge-${m.type === 'entree' ? 'success' : 'danger'}">${m.type === 'entree' ? '📥 Entrée' : '📤 Sortie'}</span></td>
          <td><strong>${m.quantite}</strong></td>
          <td>${m.quantite_avant}</td>
          <td>${m.quantite_apres}</td>
          <td>${m.motif || '—'}</td>
          <td>${m.utilisateur_nom || '—'}</td>
        </tr>`).join('')}</tbody></table>
        <div class="mt-16"><button class="btn btn-outline btn-sm" onclick="STOCK.load()">← Retour au stock</button></div>`;
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  openAdjust(prodId, nom, current) {
    document.getElementById('stockAdjustProdId').value = prodId;
    document.getElementById('stockAdjustName').textContent = nom;
    document.getElementById('stockAdjustCurrent').textContent = current;
    document.getElementById('stockAdjustQty').value = current;
    document.getElementById('stockAdjustMotif').value = '';
    document.getElementById('stockAdjustModal').style.display = 'flex';
  },

  async saveAdjust() {
    const btn = document.getElementById('btnSaveAdjust');
    const prodId = document.getElementById('stockAdjustProdId').value;
    const qty = parseFloat(document.getElementById('stockAdjustQty').value);
    const motif = document.getElementById('stockAdjustMotif').value;
    if (btn) UI.btnLoading(btn, true);
    try {
      await api(`/stock/${prodId}`, { method: 'PUT', body: { quantite: qty, motif } });
      UI.toast('✅ Stock ajusté', 'success');
      APP.closeModal('stockAdjustModal');
      this.load();
      APP.checkStockAlerts();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  },

  openPerte(prodId, nom, current) {
    document.getElementById('perteProdId').value = prodId;
    document.getElementById('perteName').textContent = nom;
    document.getElementById('perteCurrent').textContent = current;
    document.getElementById('perteQty').value = 1;
    document.getElementById('perteQty').max = current;
    document.getElementById('perteMotifType').value = 'casse';
    document.getElementById('perteMotifDetail').value = '';
    document.getElementById('perteModal').style.display = 'flex';
  },

  async savePerte() {
    const btn = document.getElementById('btnSavePerte');
    const prodId = document.getElementById('perteProdId').value;
    const qty = parseFloat(document.getElementById('perteQty').value);
    const motifType = document.getElementById('perteMotifType').value;
    const motifDetail = document.getElementById('perteMotifDetail').value;

    if (qty <= 0) return UI.toast('Quantité invalide', 'error');

    if (btn) UI.btnLoading(btn, true);
    try {
      await api('/stock/perte', {
        method: 'POST',
        body: { produit_id: prodId, quantite: qty, motif_type: motifType, motif_detail: motifDetail }
      });
      UI.toast('✅ Perte enregistrée et stock mis à jour', 'success');
      APP.closeModal('perteModal');
      this.load();
      APP.checkStockAlerts();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  }
};
