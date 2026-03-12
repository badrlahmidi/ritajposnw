import { api, API } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';
import { POS } from './pos.js';

export const ADMIN = {
  currentTab: 'produits',
  taxes: [],

  async init() {
    try { this.taxes = await api('/taxes'); } catch (e) { }
    this.switchTab('produits');
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tab}"]`)?.classList.add('active');
    if (tab === 'produits') this.loadProduits();
    else if (tab === 'categories') this.loadCategories();
    else if (tab === 'utilisateurs') this.loadUsers();
    else if (tab === 'remises') this.loadRemises();
    else if (tab === 'depenses') this.loadDepenses();
    else if (tab === 'fournisseurs') this.loadFournisseurs();
    else if (tab === 'succursales') this.loadSuccursales();
    else if (tab === 'clients') this.loadClients();
    else if (tab === 'parametres') this.loadParametres();
    else if (tab === 'backups') this.loadBackups();
  },

  async loadProduits() {
    UI.viewLoading('adminBody');
    try {
      this.products = await api('/produits?all=1');
      this.renderProductsAdmin();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  renderProductsAdmin(list) {
    const items = list || this.products || [];
    const body = document.getElementById('adminBody');
    if (!body) return;

    body.innerHTML = `
      <div class="flex-between mb-16">
        <div>
          <input type="text" placeholder="Rechercher produit..." class="input" oninput="ADMIN.filterProducts(this.value)" style="width:250px">
          <span class="text-muted ml-8" style="font-size:0.85rem">${items.length} produits</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="ADMIN.printLabels()"><span class="icon">🖨️</span> Étiquettes</button>
          <button class="btn btn-outline btn-sm" onclick="ADMIN.triggerImportCSV()"><span class="icon">📥</span> Excel/CSV</button>
          <button class="btn btn-danger btn-sm" id="btnBulkDelete" onclick="ADMIN.bulkDeleteProducts()" style="display:none">🗑️ Supprimer sélec.</button>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.openProduitForm()">+ Nouveau Produit</button>
          <input type="file" id="csvFileInput" accept=".csv" style="display:none" onchange="ADMIN.handleCSVUpload(event)">
        </div>
      </div>
      <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" onclick="ADMIN.toggleAllLabels(this)"></th>
            <th>Réf/Code</th><th>Nom</th><th>Catégorie</th><th>Prix TTC</th><th>Stock</th><th>Actif</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="adminProductsList">
          ${items.map(p => this.renderProductRow(p)).join('')}
        </tbody>
      </table>
      </div>`;
  },

  renderProductRow(p) {
    return `<tr style="${!p.actif ? 'opacity:0.5' : ''}">
        <td><input type="checkbox" class="label-check" value="${p.id}" data-name="${p.nom.replace(/"/g, '&quot;')}" data-price="${p.prix_ttc}" data-code="${p.code_barre || ''}" onchange="ADMIN.updateBulkButtons()"></td>
        <td><small>${p.code_barre || '—'}</small></td>
        <td><strong>${p.nom}</strong></td>
        <td><span class="badge" style="background:${p.categorie_couleur}22;color:${p.categorie_couleur}">${p.categorie_nom || '—'}</span></td>
        <td><strong>${p.prix_ttc.toFixed(2)} DH</strong></td>
        <td>${p.stock_quantite <= p.stock_seuil ? '<span class="text-danger">⚠️ ' + p.stock_quantite + '</span>' : p.stock_quantite}</td>
        <td>${p.actif ? '✅' : '❌'}</td>
        <td class="actions">
          <button class="btn btn-sm ${p.est_favori ? 'btn-warning' : 'btn-outline'}" onclick="ADMIN.toggleProduitFavori(${p.id}, ${p.est_favori})" title="Définir Favori">⭐</button>
          <button class="btn btn-sm btn-outline" onclick="ADMIN.editProduit(${p.id})" title="Modifier">✏️</button>
          <button class="btn btn-sm ${p.actif ? 'btn-danger' : 'btn-success'}" onclick="ADMIN.toggleProduit(${p.id}, ${p.actif})" title="${p.actif ? 'Désactiver' : 'Activer'}">${p.actif ? '🚫' : '✅'}</button>
          <button class="btn btn-sm btn-danger" onclick="ADMIN.deleteProduit(${p.id})" title="Supprimer">🗑️</button>
        </td>
      </tr>`;
  },

  filterProducts(val) {
    if (!this.products) return;
    const l = val.toLowerCase();
    const filtered = this.products.filter(p => p.nom.toLowerCase().includes(l) || (p.code_barre && p.code_barre.includes(l)));
    const tbody = document.getElementById('adminProductsList');
    if (tbody) tbody.innerHTML = filtered.map(p => this.renderProductRow(p)).join('');
  },

  toggleAllLabels(source) {
    document.querySelectorAll('.label-check').forEach(c => c.checked = source.checked);
    this.updateBulkButtons();
  },

  updateBulkButtons() {
    const checked = document.querySelectorAll('.label-check:checked').length;
    const btn = document.getElementById('btnBulkDelete');
    if (btn) btn.style.display = checked > 0 ? 'inline-block' : 'none';
  },

  async bulkDeleteProducts() {
    const selectedIds = Array.from(document.querySelectorAll('.label-check:checked')).map(c => parseInt(c.value));
    if (!selectedIds.length) return;

    const ok = await UI.confirmDialog(`Supprimer ${selectedIds.length} produits ?`, 'Cette action est irréversible pour les produits sans historique de vente.', { icon: '🗑️', danger: true });
    if (!ok) return;

    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    UI.showLoading(true);
    for (const id of selectedIds) {
      try {
        await api(`/produits/${id}`, { method: 'DELETE' });
        successCount++;
      } catch (e) {
        failCount++;
        lastError = e.message;
      }
    }
    UI.showLoading(false);

    if (successCount > 0) UI.toast(`🗑️ ${successCount} produit(s) supprimé(s)`, 'success');
    if (failCount > 0) UI.toast(`${failCount} produit(s) non supprimables : ${lastError}`, 'warning');

    this.loadProduits();
  },

  triggerImportCSV() {
    const input = document.getElementById('csvFileInput');
    if (input) input.click();
  },

  async handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input
    event.target.value = '';

    const ok = await UI.confirmDialog(
      'Importation CSV',
      `Pour fonctionner, le fichier doit comporter au minimum les colonnes (avec ; comme séparateur) :<br><br>
      <b>nom; prix_ttc; code_barre; stock; categorie</b><br><br>
      Voulez-vous procéder à l'importation de <b>${file.name}</b> ?`,
      { icon: '📥', confirmText: 'Oui, importer', cancelText: 'Annuler' }
    );
    if (!ok) return;

    UI.showLoading(true);
    try {
      const formData = new FormData();
      formData.append('csv', file);

      const res = await fetch(`${API}/produits/import`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': 'Bearer ' + state.token }
      });

      const result = await res.json();
      UI.showLoading(false);

      if (result.success) {
        UI.toast(`✅ Import terminé : ${result.count} produit(s) traité(s).`, 'success');
        if (result.erreurs && result.erreurs.length > 0) {
          console.warn('Erreurs CSV:', result.erreurs);
          UI.toast(`⚠️ Il y a eu ${result.erreurs.length} erreur(s). Voir la console.`, 'warning');
        }
        this.loadProduits();
      } else {
        UI.toast(`❌ Erreur: ${result.error}`, 'error');
      }
    } catch (e) {
      UI.showLoading(false);
      UI.toast(`❌ Erreur lors de l'envoi: ${e.message}`, 'error');
    }
  },

  printLabels() {
    const selected = Array.from(document.querySelectorAll('.label-check:checked')).map(c => ({
      id: c.value,
      nom: c.getAttribute('data-name'),
      prix: parseFloat(c.getAttribute('data-price')),
      code: c.getAttribute('data-code')
    }));

    if (!selected.length) { UI.toast('Aucun produit sélectionné', 'warning'); return; }

    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`
      <html><head><title>Étiquettes Rayon</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .label { 
          border: 2px solid #000; padding: 10px; text-align: center; page-break-inside: avoid; 
          height: 140px; display: flex; flex-direction: column; justify-content: center;
        }
        .name { font-weight: bold; font-size: 14px; margin-bottom: 5px; height: 35px; overflow: hidden; }
        .price { font-size: 28px; font-weight: 900; margin: 5px 0; }
        .code { font-family: monospace; font-size: 12px; letter-spacing: 2px; }
        .barcode-box { height: 30px; background: #eee; margin-top: 5px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #555; }
      </style>
      </head><body>
      <div class="grid">
        ${selected.map(p => `
          <div class="label">
            <div class="name">${p.nom}</div>
            <div class="price">${p.prix.toFixed(2)} <small style="font-size:14px">DH</small></div>
            <div class="code">${p.code || ''}</div>
            <div class="barcode-box">||| || ||| || ||</div> 
          </div>
        `).join('')}
      </div>
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  },

  async openProduitForm(prod = null) {
    document.getElementById('produitFormId').value = prod ? prod.id : '';
    document.getElementById('produitFormParentId').value = prod ? (prod.parent_id || '') : '';
    document.getElementById('produitFormNom').value = prod ? prod.nom : '';
    document.getElementById('produitFormPrix').value = prod ? prod.prix_ttc : '';
    document.getElementById('produitFormImageBytes').src = prod && prod.image ? '/uploads/' + prod.image : '';
    document.getElementById('produitFormImageBytes').style.display = prod && prod.image ? 'block' : 'none';
    document.getElementById('produitFormCout').value = prod ? prod.cout_revient || '' : '';
    document.getElementById('produitFormBarcode').value = prod ? prod.code_barre || '' : '';
    document.getElementById('produitFormDesc').value = prod ? prod.description || '' : '';
    document.getElementById('produitFormUnite').value = prod ? prod.unite || 'piece' : 'piece';
    document.getElementById('produitFormPoids').value = prod ? prod.poids_net || '' : '';
    document.getElementById('produitFormTitle').textContent = prod ? '✏️ Modifier Produit' : '🍞 Nouveau Produit';

    const btnVar = document.getElementById('btnCreateVariant');
    if (prod && !prod.parent_id && btnVar) {
      btnVar.style.display = 'block';
    } else if (btnVar) {
      btnVar.style.display = 'none';
    }

    try {
      const cats = await api('/categories');
      document.getElementById('produitFormCat').innerHTML = '<option value="">— Aucune —</option>' + cats.map(c => `<option value="${c.id}" ${prod && prod.categorie_id == c.id ? 'selected' : ''}>${c.icone} ${c.nom}</option>`).join('');
    } catch (e) { }

    document.getElementById('produitFormTaxe').innerHTML = this.taxes.map(t => `<option value="${t.id}" ${prod && prod.taxe_id == t.id ? 'selected' : ''}>${t.nom} (${t.taux}%)</option>`).join('');

    document.getElementById('produitFormDlc').value = prod && prod.dlc ? prod.dlc : '';
    document.getElementById('produitFormPrixSemi').value = prod ? prod.prix_semi_gros || '' : '';
    document.getElementById('produitFormPrixGros').value = prod ? prod.prix_gros || '' : '';

    document.getElementById('produitFormModal').style.display = 'flex';
  },

  async createVariant(parentId) {
    if (!parentId) return;
    try {
      const prods = await api(`/produits?all=1`);
      const parent = prods.find(x => x.id == parentId);
      if (!parent) return;

      this.openProduitForm({
        ...parent,
        id: '',
        parent_id: parent.id,
        nom: parent.nom + ' (Var)',
        code_barre: '',
        stock_quantite: 0
      });
      document.getElementById('produitFormTitle').textContent = '➕ Nouvelle Variante';
      document.getElementById('btnCreateVariant').style.display = 'none';
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async editProduit(id) {
    try {
      let p = (this.products || []).find(x => x.id == id);
      if (!p) {
        const prods = await api(`/produits?all=1`);
        this.products = prods;
        p = prods.find(x => x.id == id);
      }
      if (p) this.openProduitForm(p);
      else UI.toast('Produit non trouvé', 'warning');
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async saveProduit() {
    const btn = document.getElementById('btnSaveProduit');

    const id = document.getElementById('produitFormId').value;
    const parentId = document.getElementById('produitFormParentId').value;
    const nomEl = document.getElementById('produitFormNom');
    const prixEl = document.getElementById('produitFormPrix');

    let valid = true;
    valid &= UI.validateField(nomEl, { required: true });
    valid &= UI.validateField(prixEl, { required: true, min: 0 });

    if (!valid) { UI.toast('Merci de remplir les champs obligatoires (*)', 'error'); return; }

    const formData = new FormData();
    formData.append('nom', nomEl.value.trim());
    formData.append('prix_ttc', parseFloat(prixEl.value));
    formData.append('categorie_id', parseInt(document.getElementById('produitFormCat').value) || '');
    formData.append('taxe_id', parseInt(document.getElementById('produitFormTaxe').value) || 1);
    formData.append('prix_semi_gros', parseFloat(document.getElementById('produitFormPrixSemi').value) || 0);
    formData.append('prix_gros', parseFloat(document.getElementById('produitFormPrixGros').value) || 0);
    formData.append('cout_revient', parseFloat(document.getElementById('produitFormCout').value) || 0);
    formData.append('code_barre', document.getElementById('produitFormBarcode').value.trim());
    formData.append('dlc', document.getElementById('produitFormDlc').value || '');
    formData.append('description', document.getElementById('produitFormDesc').value.trim());
    formData.append('unite', document.getElementById('produitFormUnite').value);
    formData.append('poids_net', parseFloat(document.getElementById('produitFormPoids').value) || 0);
    if (parentId) formData.append('parent_id', parseInt(parentId));

    const imageFile = document.getElementById('produitFormImage').files[0];
    if (imageFile) formData.append('image', imageFile);

    if (btn) UI.btnLoading(btn, true);

    try {
      const options = {
        method: id ? 'PUT' : 'POST',
        body: formData
      };

      if (id) await api(`/produits/${id}`, options);
      else await api('/produits', options);

      UI.toast('✅ Produit enregistré', 'success');
      APP.closeModal('produitFormModal');
      this.loadProduits();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  },

  async toggleProduit(id, currentActif) {
    const newState = currentActif ? 0 : 1;

    if (currentActif) {
      const ok = await UI.confirmDialog('Désactiver ce produit ?', 'Il ne sera plus visible en caisse.', { icon: '🚫', danger: true });
      if (!ok) return;
    }

    try {
      // Since backend now supports partial updates via PUT, we can just send the field to change.
      await api(`/produits/${id}`, {
        method: 'PUT',
        body: { actif: newState }
      });
      this.loadProduits();
      UI.toast(newState ? 'Produit activé' : 'Produit désactivé', 'success');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async toggleProduitFavori(id, currentFavori) {
    const newState = currentFavori ? 0 : 1;
    try {
      await api(`/produits/${id}`, {
        method: 'PUT',
        body: { est_favori: newState }
      });
      this.loadProduits();
      UI.toast(newState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris', 'success');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async deleteProduit(id) {
    const ok = await UI.confirmDialog('Supprimer ce produit ?', 'Cette action est irréversible. Si le produit a déjà été vendu, vous ne pourrez que le désactiver.', { icon: '🗑️', danger: true });
    if (!ok) return;

    try {
      await api(`/produits/${id}`, { method: 'DELETE' });
      UI.toast('🗑️ Produit supprimé', 'success');
      this.loadProduits();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async loadCategories() {
    try {
      const cats = await api('/categories/all');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${cats.length} catégorie(s)</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.addCategory()">+ Nouvelle Catégorie</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Icône</th><th>Nom</th><th>Couleur</th><th>Ordre</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>${cats.map(c => `<tr style="${!c.actif ? 'opacity:0.5' : ''}">
          <td style="font-size:1.4rem">${c.icone}</td>
          <td><strong>${c.nom}</strong></td>
          <td><span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${c.couleur}"></span> ${c.couleur}</td>
          <td>${c.ordre}</td>
          <td>${c.actif ? '✅' : '❌'}</td>
          <td class="actions">
             <button class="btn btn-sm btn-outline" onclick="ADMIN.editCategory(${c.id})" title="Modifier">✏️</button>
             <button class="btn btn-sm ${c.actif ? 'btn-danger' : 'btn-success'}" onclick="ADMIN.toggleCategory(${c.id}, ${c.actif})">${c.actif ? '🚫' : '✅'}</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  openCategoryForm(cat = null) {
    // Create modal if not exists (dynamic creation for categories as it wasn't in index.html)
    let modal = document.getElementById('categoryFormModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'categoryFormModal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
              <div class="modal">
                <div class="modal-header">
                  <h2 id="categoryFormTitle">📂 Catégorie</h2>
                  <button class="btn btn-icon modal-close" onclick="APP.closeModal('categoryFormModal')">✕</button>
                </div>
                <div class="modal-body">
                  <input type="hidden" id="categoryFormId">
                  <div class="form-group"><label>Nom *</label><input type="text" id="categoryFormNom" required></div>
                  <div class="form-row">
                    <div class="form-group"><label>Couleur</label><input type="color" id="categoryFormColor" style="height:40px"></div>
                    <div class="form-group"><label>Icône (Emoji)</label><input type="text" id="categoryFormIcon" maxlength="2"></div>
                    <div class="form-group"><label>Ordre</label><input type="number" id="categoryFormOrder"></div>
                  </div>
                  <div class="form-group">
                    <label>Image</label>
                    <div style="display:flex;align-items:center;gap:10px">
                        <input type="file" id="categoryFormImage" accept="image/*">
                        <img id="categoryFormImageBytes" src="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;display:none;border:1px solid #ddd">
                    </div>
                  </div>
                  <div class="form-actions">
                    <button id="btnSaveCategory" class="btn btn-primary" onclick="ADMIN.saveCategory()">💾 Enregistrer</button>
                    <button class="btn btn-secondary" onclick="APP.closeModal('categoryFormModal')">Annuler</button>
                  </div>
                </div>
              </div>`;
      document.body.appendChild(modal);
    }

    document.getElementById('categoryFormId').value = cat ? cat.id : '';
    document.getElementById('categoryFormTitle').textContent = cat ? '✏️ Modifier Catégorie' : '📂 Nouvelle Catégorie';
    document.getElementById('categoryFormNom').value = cat ? cat.nom : '';
    document.getElementById('categoryFormColor').value = cat ? cat.couleur : '#e67e22';
    document.getElementById('categoryFormIcon').value = cat ? cat.icone : '🍞';
    document.getElementById('categoryFormOrder').value = cat ? cat.ordre : 0;

    const img = document.getElementById('categoryFormImageBytes');
    if (cat && cat.image) {
      img.src = '/uploads/' + cat.image;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
    document.getElementById('categoryFormImage').value = '';

    modal.style.display = 'flex';
  },

  async saveCategory() {
    const btn = document.getElementById('btnSaveCategory');
    const id = document.getElementById('categoryFormId').value;
    const nomEl = document.getElementById('categoryFormNom');
    if (!UI.validateField(nomEl, { required: true })) return;

    const formData = new FormData();
    formData.append('nom', nomEl.value.trim());
    formData.append('couleur', document.getElementById('categoryFormColor').value);
    formData.append('icone', document.getElementById('categoryFormIcon').value);
    formData.append('ordre', parseInt(document.getElementById('categoryFormOrder').value) || 0);

    const imageFile = document.getElementById('categoryFormImage').files[0];
    if (imageFile) formData.append('image', imageFile);

    if (btn) UI.btnLoading(btn, true);

    try {
      const options = { method: id ? 'PUT' : 'POST', body: formData };
      const url = id ? `/categories/${id}` : '/categories';
      await api(url, options);
      UI.toast(id ? '✅ Catégorie modifiée' : '✅ Catégorie créée', 'success');
      APP.closeModal('categoryFormModal');
      this.loadCategories();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  },

  addCategory() {
    this.openCategoryForm();
  },

  editCategory(id) { // Changed signature to just take ID, fetch happens inside or earlier
    // We need the full object. But let's fetch it from list again or pass object
    this.loadCategoryForEdit(id);
  },

  async loadCategoryForEdit(id) {
    try {
      const cats = await api('/categories/all');
      const c = cats.find(x => x.id == id);
      if (c) this.openCategoryForm(c);
      else UI.toast('Catégorie non trouvée', 'warning');
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async toggleCategory(id, currentActif) {
    if (currentActif) {
      const ok = await UI.confirmDialog('Désactiver la catégorie ?', 'Les produits de cette catégorie seront cachés.', { danger: true });
      if (!ok) return;
    }
    try {
      await api(`/categories/${id}`, { method: 'PUT', body: { actif: currentActif ? 0 : 1 } });
      this.loadCategories();
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async loadUsers() {
    try {
      const users = await api('/utilisateurs');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${users.length} utilisateur(s)</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.openUserForm()">+ Nouvel Utilisateur</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Nom</th><th>Login</th><th>Rôle</th><th>Dernière connexion</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u => `<tr style="${!u.actif ? 'opacity:0.5' : ''}">
          <td><strong>${u.prenom || ''} ${u.nom}</strong></td>
          <td>${u.login}</td>
          <td><span class="badge badge-${u.role === 'admin' ? 'danger' : u.role === 'manager' ? 'warning' : 'info'}">${u.role}</span></td>
          <td>${u.derniere_connexion ? new Date(u.derniere_connexion).toLocaleString('fr-FR') : '—'}</td>
          <td>${u.actif ? '✅' : '❌'}</td>
          <td class="actions">
             <button class="btn btn-sm btn-outline" onclick="ADMIN.loadUserForEdit(${u.id})">✏️</button>
             <button class="btn btn-sm btn-danger" onclick="ADMIN.deleteUser(${u.id})">🗑️</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  openUserForm(user = null) {
    document.getElementById('userFormId').value = user ? user.id : '';
    document.getElementById('userFormNom').value = user ? user.nom : '';
    document.getElementById('userFormPrenom').value = user ? user.prenom || '' : '';
    document.getElementById('userFormLogin').value = user ? user.login : '';
    document.getElementById('userFormPass').value = '';
    document.getElementById('userFormRole').value = user ? user.role : 'caissier';
    document.getElementById('userFormEmail').value = user ? user.email || '' : '';
    document.getElementById('userFormTitle').textContent = user ? '✏️ Modifier Utilisateur' : '👤 Nouvel Utilisateur';
    document.getElementById('userFormModal').style.display = 'flex';
  },

  async loadUserForEdit(id) {
    try {
      const users = await api('/utilisateurs');
      const u = users.find(x => x.id == id);
      if (u) this.openUserForm(u);
      else UI.toast('Utilisateur non trouvé', 'warning');
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async deleteUser(id) {
    if (!await UI.confirmDialog('Supprimer cet utilisateur ?', 'Cette action est irréversible.', { danger: true })) return;
    try {
      await api(`/utilisateurs/${id}`, { method: 'DELETE' });
      UI.toast('🗑️ Utilisateur supprimé', 'success');
      this.loadUsers();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  editUser(user) { this.openUserForm(user); },

  async saveUser() {
    const btn = document.getElementById('btnSaveUser');
    const id = document.getElementById('userFormId').value;
    const nomEl = document.getElementById('userFormNom');
    const loginEl = document.getElementById('userFormLogin');
    const emailEl = document.getElementById('userFormEmail');

    let valid = true;
    valid &= UI.validateField(nomEl, { required: true });
    valid &= UI.validateField(loginEl, { required: true, minLength: 3 });
    if (emailEl.value) valid &= UI.validateField(emailEl, { email: true });

    if (!valid) { UI.toast('Formulaire invalide', 'error'); return; }

    const body = {
      nom: nomEl.value.trim(),
      prenom: document.getElementById('userFormPrenom').value.trim(),
      login: loginEl.value.trim(),
      role: document.getElementById('userFormRole').value,
      email: emailEl.value.trim(),
      actif: 1
    };
    const pass = document.getElementById('userFormPass').value;
    if (pass) body.password = pass;

    if (!id && !pass) { UI.toast('Mot de passe requis pour un nouvel utilisateur', 'error'); return; }

    if (btn) UI.btnLoading(btn, true);

    try {
      if (id) await api(`/utilisateurs/${id}`, { method: 'PUT', body });
      else await api('/utilisateurs', { method: 'POST', body: { ...body, password: pass } });
      UI.toast('✅ Utilisateur enregistré', 'success');
      APP.closeModal('userFormModal');
      this.loadUsers();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  },

  async loadRemises() {
    try {
      const remises = await api('/remises');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${remises.length} remise(s) active(s)</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.addRemise()">+ Nouvelle Remise</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Nom</th><th>Type</th><th>Valeur</th><th>Min.</th><th>Période</th><th>Actions</th></tr></thead>
        <tbody>${remises.map(r => `<tr>
          <td><strong>${r.nom}</strong></td>
          <td>${r.type === 'pourcentage' ? '📊 Pourcentage' : r.type === 'bogo' ? '🎁 2 pour 1' : r.type === '3_pour_2' ? '🎁 3 pour 2' : r.type === '2eme_50' ? '🎁 2ème -50%' : '💰 Montant'}</td>
          <td><strong>${r.type === 'pourcentage' ? r.valeur + '%' : ['bogo', '3_pour_2', '2eme_50'].includes(r.type) ? 'Auto' : r.valeur + ' DH'}</strong><br><small>${r.produit_id ? 'Prod #' + r.produit_id : 'Global'}</small></td>
          <td>${r.condition_min ? r.condition_min + ' DH min.' : '—'}</td>
          <td>${r.date_debut && r.date_fin ? r.date_debut + ' → ' + r.date_fin : 'Permanent'}</td>
          <td class="actions">
             <button class="btn btn-sm btn-danger" onclick="ADMIN.deleteRemise(${r.id})">🗑️</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async addRemise() {
    const nom = await APP.prompt('Nom de la remise:'); if (!nom) return;
    const type = await APP.prompt('Type (pourcentage / montant / bogo / 3_pour_2 / 2eme_50):', '', 'pourcentage') || 'pourcentage';
    const valStr = await APP.prompt('Valeur (% ou DH, 0 pour les lots):', '', '10', 'number');
    const valeur = parseFloat(valStr) || 0;
    const prodIdStr = await APP.prompt('ID du produit ciblé (Laissez vide pour global):', '', '', 'number');
    const produit_id = parseInt(prodIdStr) || null;

    try {
      await api('/remises', { method: 'POST', body: { nom, type, valeur, produit_id } });
      UI.toast('✅ Remise créée', 'success');
      this.loadRemises();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async deleteRemise(id) {
    if (!await UI.confirmDialog('Supprimer cette remise ?', 'Elle ne sera plus disponible.', { danger: true })) return;
    try {
      await api(`/remises/${id}`, { method: 'DELETE' });
      UI.toast('✅ Remise supprimée', 'success');
      this.loadRemises();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async loadDepenses() {
    try {
      const depenses = await api('/depenses');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${depenses.length} dépense(s)</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.addDepense()">+ Nouvelle Dépense</button>
        </div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Date</th><th>Catégorie</th><th>Montant</th><th>Description</th><th>Paiement</th><th>Par</th><th>Actions</th></tr></thead>
        <tbody>${depenses.map(d => `<tr>
          <td>${d.date_depense}</td>
          <td><strong>${d.categorie}</strong></td>
          <td class="text-danger"><strong>${(d.montant || 0).toFixed(2)} DH</strong></td>
          <td>${d.description || '—'}</td>
          <td>${d.mode_paiement === 'especes' ? '💵' : '💳'}</td>
          <td>${d.utilisateur_nom || '—'}</td>
          <td class="actions">
             <button class="btn btn-sm btn-danger" onclick="ADMIN.deleteDepense(${d.id})">🗑️</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async addDepense() {
    const categorie = await APP.prompt('Catégorie', 'Matières premières, Loyer, Salaires, Fournitures, Autre:');
    if (!categorie) return;
    const valMontant = await APP.prompt('Montant (DH):', '', '', 'number');
    const montant = parseFloat(valMontant); if (!montant) return;
    const description = await APP.prompt('Description:') || '';
    try {
      await api('/depenses', { method: 'POST', body: { categorie, montant, description } });
      UI.toast('✅ Dépense enregistrée', 'success');
      this.loadDepenses();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },
  async deleteDepense(id) {
    if (!await UI.confirmDialog('Supprimer cette dépense ?', 'Cette action est irréversible.', { danger: true })) return;
    try {
      await api(`/depenses/${id}`, { method: 'DELETE' });
      UI.toast('✅ Dépense supprimée', 'success');
      this.loadDepenses();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async loadFournisseurs() {
    UI.viewLoading('adminBody');
    try {
      const fournisseurs = await api('/fournisseurs');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${fournisseurs.length} fournisseur(s) actif(s)</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.openFournisseurForm()">+ Nouveau Fournisseur</button>
        </div>
        <div class="table-responsive"><table class="data-table">
          <thead><tr><th>Nom</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Actions</th></tr></thead>
          <tbody>
            ${fournisseurs.map(f => `<tr>
              <td><strong>${f.nom}</strong></td>
              <td>${f.contact || '—'}</td>
              <td>${f.telephone || '—'}</td>
              <td>${f.email || '—'}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick='ADMIN.openFournisseurForm(${JSON.stringify(f).replace(/'/g, "&#39;")})'>✏️</button>
                <button class="btn btn-sm btn-danger" onclick="ADMIN.deleteFournisseur(${f.id})">🗑️</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      `;
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  openFournisseurForm(f = null) {
    document.getElementById('fournisseurFormId').value = f ? f.id : '';
    document.getElementById('fournisseurFormNom').value = f ? f.nom : '';
    document.getElementById('fournisseurFormContact').value = f ? f.contact || '' : '';
    document.getElementById('fournisseurFormTel').value = f ? f.telephone || '' : '';
    document.getElementById('fournisseurFormEmail').value = f ? f.email || '' : '';
    document.getElementById('fournisseurFormAdresse').value = f ? f.adresse || '' : '';
    document.getElementById('fournisseurFormNotes').value = f ? f.notes || '' : '';

    document.getElementById('fournisseurFormTitle').textContent = f ? '✏️ Modifier Fournisseur' : '🚚 Nouveau Fournisseur';
    document.getElementById('fournisseurFormModal').style.display = 'flex';
  },

  async saveFournisseur() {
    const btn = document.getElementById('btnSaveFournisseur');
    const id = document.getElementById('fournisseurFormId').value;
    const nomEl = document.getElementById('fournisseurFormNom');
    if (!UI.validateField(nomEl, { required: true })) return UI.toast('Le nom est requis', 'error');

    const body = {
      nom: nomEl.value.trim(),
      contact: document.getElementById('fournisseurFormContact').value.trim(),
      telephone: document.getElementById('fournisseurFormTel').value.trim(),
      email: document.getElementById('fournisseurFormEmail').value.trim(),
      adresse: document.getElementById('fournisseurFormAdresse').value.trim(),
      notes: document.getElementById('fournisseurFormNotes').value.trim()
    };

    if (btn) UI.btnLoading(btn, true);

    try {
      if (id) await api(`/fournisseurs/${id}`, { method: 'PUT', body });
      else await api('/fournisseurs', { method: 'POST', body });

      UI.toast('✅ Fournisseur enregistré', 'success');
      APP.closeModal('fournisseurFormModal');
      this.loadFournisseurs();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  },

  async deleteFournisseur(id) {
    if (!await UI.confirmDialog('Désactiver ce fournisseur ?', "Le fournisseur ne sera plus listé.", { danger: true })) return;
    try {
      await api(`/fournisseurs/${id}`, { method: 'DELETE' });
      UI.toast('✅ Fournisseur supprimé', 'success');
      this.loadFournisseurs();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  // ════════ SUCCURSALES ════════

  async loadSuccursales() {
    UI.viewLoading('adminBody');
    try {
      const succursales = await api('/succursales');
      const body = document.getElementById('adminBody');
      if (!body) return;

      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${succursales.length} succursale(s) au total</p>
          <button class="btn btn-primary btn-sm" onclick="ADMIN.openSuccursaleForm()">+ Nouvelle Succursale</button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Nom</th><th>Ville</th><th>Téléphone</th><th>ICE</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${succursales.map(s => `
                <tr style="${!s.actif ? 'opacity:0.6' : ''}">
                  <td>#${s.id}</td>
                  <td><strong>${s.nom}</strong> ${s.id === 1 ? '<span class="badge badge-primary">Principal</span>' : ''}</td>
                  <td>${s.ville || '—'}</td>
                  <td>${s.telephone || '—'}</td>
                  <td>${s.ice || '—'}</td>
                  <td>${s.actif ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-danger">Inactif</span>'}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick='ADMIN.openSuccursaleForm(${JSON.stringify(s).replace(/'/g, "&#39;")})'>✏️</button>
                    ${s.id !== 1 ? `<button class="btn btn-sm ${s.actif ? 'btn-danger' : 'btn-success'}" onclick="ADMIN.toggleSuccursale(${s.id})">${s.actif ? 'Désactiver' : 'Activer'}</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  openSuccursaleForm(s = null) {
    let modal = document.getElementById('succursaleFormModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'succursaleFormModal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="modal card" style="max-width:500px;width:95%">
        <div class="modal-header">
          <h2 id="succursaleFormTitle">${s ? '✏️ Modifier Succursale' : '🏢 Nouvelle Succursale'}</h2>
          <button class="btn-icon modal-close" onclick="APP.closeModal('succursaleFormModal')">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="succFormId" value="${s ? s.id : ''}">
          <div class="form-group">
            <label>Nom du magasin *</label>
            <input type="text" id="succFormNom" class="input-full" value="${s ? s.nom : ''}" placeholder="Ex: Boutique Centre-ville">
          </div>
          <div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label>Ville</label><input type="text" id="succFormVille" class="input-full" value="${s ? s.ville : ''}"></div>
            <div><label>Téléphone</label><input type="text" id="succFormTel" class="input-full" value="${s ? s.telephone : ''}"></div>
          </div>
          <div class="form-group">
            <label>Adresse complète</label>
            <textarea id="succFormAdresse" class="input-full" rows="2">${s ? s.adresse : ''}</textarea>
          </div>
          <div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label>Email</label><input type="email" id="succFormEmail" class="input-full" value="${s ? s.email : ''}"></div>
            <div><label>ICE</label><input type="text" id="succFormIce" class="input-full" value="${s ? s.ice : ''}"></div>
          </div>
          ${s && s.id !== 1 ? `
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="succFormActif" ${s.actif ? 'checked' : ''} style="width:auto"> Actif
            </label>
          </div>` : ''}
          <div class="form-actions" style="margin-top:20px;justify-content:flex-end">
            <button class="btn" onclick="APP.closeModal('succursaleFormModal')">Annuler</button>
            <button id="btnSaveSucc" class="btn btn-primary" onclick="ADMIN.saveSuccursale()">✅ Enregistrer</button>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  async saveSuccursale() {
    const btn = document.getElementById('btnSaveSucc');
    const id = document.getElementById('succFormId').value;
    const isEdit = id && id !== '';

    const body = {
      nom: document.getElementById('succFormNom').value.trim(),
      ville: document.getElementById('succFormVille').value.trim(),
      telephone: document.getElementById('succFormTel').value.trim(),
      adresse: document.getElementById('succFormAdresse').value.trim(),
      email: document.getElementById('succFormEmail').value.trim(),
      ice: document.getElementById('succFormIce').value.trim(),
    };
    if (!body.nom) return UI.toast('Le nom est requis', 'error');

    const cbActif = document.getElementById('succFormActif');
    if (cbActif) body.actif = cbActif.checked;

    if (btn) UI.btnLoading(btn, true);
    try {
      if (isEdit) {
        await api(`/succursales/${id}`, { method: 'PUT', body });
      } else {
        await api('/succursales', { method: 'POST', body });
      }
      UI.toast(isEdit ? 'Succursale modifiée' : 'Succursale créée', 'success');
      APP.closeModal('succursaleFormModal');
      this.loadSuccursales();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    } finally {
      if (btn) UI.btnLoading(btn, false);
    }
  },

  async toggleSuccursale(id) {
    if (id === 1) return; // Impossible de désactiver la #1
    if (!await UI.confirmDialog('Modifier le statut ?', "Confirmez-vous le changement de statut de cette succursale ?", { danger: true })) return;
    try {
      await api(`/succursales/${id}/toggle`, { method: 'PATCH' });
      UI.toast('Statut modifié avec succès', 'success');
      this.loadSuccursales();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async loadClients() {
    UI.viewLoading('adminBody');
    try {
      const clients = await api('/clients?all=1');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="flex-between mb-16">
          <p>${clients.length} client(s) au total</p>
          <button class="btn btn-primary btn-sm" onclick="CLIENTS.openForm()">+ Nouveau Client</button>
        </div>
        <div class="table-responsive"><table class="data-table">
          <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Tarif</th><th>Fidélité</th><th>Crédit</th><th>Actif</th><th>Actions</th></tr></thead>
          <tbody>
            ${clients.map(c => `<tr style="${!c.actif ? 'opacity:0.5' : ''}">
              <td><strong>${c.nom}</strong></td>
              <td>${c.telephone || '—'}</td>
              <td>${c.email || '—'}</td>
              <td><span class="badge ${c.type_tarif === 'gros' ? 'badge-danger' : c.type_tarif === 'semi_gros' ? 'badge-warning' : 'badge-info'}">${c.type_tarif === 'gros' ? '🏭 Gros' : c.type_tarif === 'semi_gros' ? '🏢 Semi' : '👤 Détail'}</span></td>
              <td>${c.points_fidelite} pts</td>
              <td class="text-${c.solde_credit > 0 ? 'danger' : 'success'}">${(c.solde_credit || 0).toFixed(2)} DH</td>
              <td>${c.actif ? '✅' : '❌'}</td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" onclick="CLIENTS.edit(${c.id})" title="Modifier">✏️</button>
                <button class="btn btn-sm ${c.actif ? 'btn-danger' : 'btn-success'}" onclick="ADMIN.toggleClient(${c.id}, ${c.actif})" title="${c.actif ? 'Désactiver' : 'Activer'}">${c.actif ? '🚫' : '✅'}</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      `;
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  },

  async toggleClient(id, actif) {
    if (!actif) {
      // Activer
      try {
        await api(`/clients/${id}`, { method: 'PUT', body: { actif: 1 } });
        UI.toast('✅ Client activé', 'success');
        this.loadClients();
        if (typeof CLIENTS !== 'undefined') CLIENTS.load();
      } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    } else {
      // Désactiver
      if (!await UI.confirmDialog('Désactiver ce client ?', 'Le client sera masqué de la liste.', { danger: true })) return;
      try {
        await api(`/clients/${id}`, { method: 'DELETE' });
        UI.toast('✅ Client désactivé', 'success');
        this.loadClients();
        if (typeof CLIENTS !== 'undefined') CLIENTS.load();
      } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    }
  },

  async loadParametres() {
    try {
      const params = await api('/parametres');
      const body = document.getElementById('adminBody');
      const fields = [
        ['nom_commerce', 'Nom du commerce', 'text'],
        ['raison_sociale', 'Raison sociale officielle', 'text'],
        ['adresse', 'Adresse', 'text'],
        ['telephone', 'Téléphone', 'text'],
        ['ice', 'ICE (15 chiffres)', 'text'],
        ['identifiant_fiscal', 'Identifiant Fiscal (IF)', 'text'],
        ['registre_commerce', 'Registre de Commerce (RC)', 'text'],
        ['numero_patente', 'N° Patente', 'text'],
        ['cnss', 'N° CNSS', 'text'],
        ['devise', 'Devise', 'text'],
        ['tva_defaut', 'TVA par défaut (%)', 'number'],
        ['points_par_dh', 'Points fidélité par DH', 'number'],
        ['seuil_points_cadeau', 'Seuil points cadeau', 'number'],
        ['ticket_header', 'En-tête ticket', 'text'],
        ['ticket_footer', 'Pied de ticket', 'text'],
        ['ticket_message_promo', 'Message promo ticket', 'text'],
      ];

      const ticketOptions = [
        ['ticket_show_logo', '🏪 Nom du commerce', 'Affiche le nom en haut du ticket'],
        ['ticket_show_adresse', '📍 Adresse', 'Affiche l\'adresse du commerce'],
        ['ticket_show_telephone', '📞 Téléphone', 'Affiche le numéro de téléphone'],
        ['ticket_show_ice', '🆔 ICE', 'Affiche l\'identifiant ICE'],
        ['ticket_show_numero', '🔢 N° commande', 'Affiche le numéro de commande'],
        ['ticket_show_date_heure', '📅 Date & heure', 'Affiche la date et l\'heure'],
        ['ticket_show_caissier', '👤 Caissier', 'Affiche le nom du caissier'],
        ['ticket_show_client', '👥 Client', 'Affiche le nom du client'],
        ['ticket_show_type_cmd', '🏠 Type commande', 'Sur place / Emporter / Livraison'],
        ['ticket_show_articles', '📋 Détail articles', 'Liste des articles avec prix'],
        ['ticket_show_tva_detail', '📊 Détail TVA/ligne', 'TVA par article'],
        ['ticket_show_ht', '💶 Sous-total HT + TVA', 'Affiche HT et montant TVA'],
        ['ticket_show_remise', '🏷️ Remise', 'Affiche la remise appliquée'],
        ['ticket_show_mode_paiement', '💳 Mode paiement', 'Espèces ou Carte'],
        ['ticket_show_monnaie', '💰 Monnaie rendue', 'Affiche montant reçu et monnaie'],
        ['ticket_show_points', '⭐ Points fidélité', 'Affiche les points gagnés'],
        ['ticket_show_header', '📝 En-tête perso', 'Message personnalisé en-tête'],
        ['ticket_show_footer', '📝 Pied de page', 'Message personnalisé en bas'],
      ];

      const featureOptions = [
        ['feature_fidelite', '⭐ Programme Fidélité', 'Gérer les points et récompenses'],
        ['feature_livraison', '🛵 Gestion Livraison', 'Module de livraison et livreurs'],
        ['feature_pourboire', '💰 Pourboires', 'Gestion des pourboires serveurs'],
        ['feature_dlc', '📅 Dates Péremption', 'Suivi des dates limites (DLC)'],
        ['feature_credit', '📒 Crédit Client', 'Gestion des ardoises / dettes'],
        ['feature_negative_stock', '📦 Vente en Négatif', 'Autoriser la vente même sans stock']
      ];

      const paymentOptions = [
        ['paiement_cheque', '🏦 Chèque', 'Accepter les paiements par chèque bancaire'],
        ['paiement_virement', '📲 Virement', 'Accepter les virements bancaires']
      ];

      body.innerHTML = `
    <div class="card">
      <h3 class="mb-16">🔧 Paramètres du Commerce</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${fields.map(([key, label, type]) => `
          <div class="form-group">
            <label>${label}</label>
            <input type="${type}" id="param_${key}" value="${params[key] || ''}" data-key="${key}">
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3 class="mb-16">⚡ Fonctionnalités Actives</h3>
        <p style="color:#666;margin-bottom:12px;font-size:13px">Activez uniquement les modules dont vous avez besoin :</p>
        <div class="ticket-options-grid">
        ${featureOptions.map(([key, label, desc]) => {
        const isOn = params[key] !== '0';
        return `<div class="ticket-option ${isOn ? 'active' : ''}" id="fopt_${key}" onclick="ADMIN.toggleTicketOption('${key}', 'fopt_')" title="${desc}">
            <div class="ticket-opt-toggle">${isOn ? '✅' : '⬜'}</div>
            <div class="ticket-opt-info">
              <div class="ticket-opt-label">${label}</div>
              <div class="ticket-opt-desc">${desc}</div>
            </div>
          </div>`;
      }).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3 class="mb-16">💳 Moyens de Paiement</h3>
      <p style="color:#666;margin-bottom:12px;font-size:13px">Gérez les moyens d'encaissements acceptés dans la caisse :</p>
      <div class="ticket-options-grid">
        ${paymentOptions.map(([key, label, desc]) => {
        const isOn = params[key] !== '0';
        return `<div class="ticket-option ${isOn ? 'active' : ''}" id="popt_${key}" onclick="ADMIN.toggleTicketOption('${key}', 'popt_')" title="${desc}">
            <div class="ticket-opt-toggle">${isOn ? '✅' : '⬜'}</div>
            <div class="ticket-opt-info">
              <div class="ticket-opt-label">${label}</div>
              <div class="ticket-opt-desc">${desc}</div>
            </div>
          </div>`;
      }).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3 class="mb-16">🧾 Personnalisation du Ticket</h3>
      <p style="color:#666;margin-bottom:12px;font-size:13px">Activez ou désactivez les éléments visibles sur le ticket imprimé :</p>
      <div class="ticket-options-grid">
        ${ticketOptions.map(([key, label, desc]) => {
        const isOn = params[key] !== '0';
        return `<div class="ticket-option ${isOn ? 'active' : ''}" id="topt_${key}" onclick="ADMIN.toggleTicketOption('${key}', 'topt_')" title="${desc}">
            <div class="ticket-opt-toggle">${isOn ? '✅' : '⬜'}</div>
            <div class="ticket-opt-info">
              <div class="ticket-opt-label">${label}</div>
              <div class="ticket-opt-desc">${desc}</div>
            </div>
          </div>`;
      }).join('')}
      </div>
      <div style="margin-top:12px;display:flex;gap:12px;align-items:center">
        <label style="font-weight:600;white-space:nowrap">📏 Taille police (px):</label>
        <input type="number" id="param_ticket_font_size" value="${params.ticket_font_size || '13'}" data-key="ticket_font_size" min="10" max="20" style="width:80px">
        <label style="font-weight:600;white-space:nowrap;margin-left:16px">📐 Largeur ticket (px):</label>
        <input type="number" id="param_ticket_largeur" value="${params.ticket_largeur || '300'}" data-key="ticket_largeur" min="200" max="400" style="width:80px">
      </div>
    </div>

    <div class="form-actions" style="margin-top:16px">
      <button id="btnSaveParametres" class="btn btn-primary" onclick="ADMIN.saveParametres()">💾 Enregistrer tout</button>
      <button class="btn btn-secondary" onclick="ADMIN.previewTicket()" style="margin-left:8px">👁️ Aperçu ticket</button>
    </div>

    <div class="card danger-zone" style="margin-top:32px;border:2px solid var(--danger);background:#fff5f5">
      <h3 class="text-danger mb-16">⚠️ Zone de Danger (Réinitialisation)</h3>
      <p class="mb-16" style="color:var(--danger-dark)">Attention : Réinitialiser la base de données effacera TOUTES les commandes, produits, stocks et clients. Les comptes utilisateurs et paramètres généraux seront conservés.</p>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="flex:1">
            <label style="font-weight:bold;display:block;margin-bottom:4px">Nouveau Profil Métier :</label>
            <select id="resetMode" class="input" style="width:100%">
              <option value="retail">🛒 Mode Retail / Superette</option>
            </select>
          </div>
          <button class="btn btn-danger" onclick="ADMIN.resetDatabase()" style="margin-top:20px">💥 Réinitialiser / Changer Métier</button>
      </div>
    </div>`;
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  toggleTicketOption(key, prefix = 'topt_') {
    const el = document.getElementById(`${prefix}${key}`);
    if (!el) return;
    const isActive = el.classList.contains('active');
    if (isActive) {
      el.classList.remove('active');
      el.querySelector('.ticket-opt-toggle').textContent = '⬜';
    } else {
      el.classList.add('active');
      el.querySelector('.ticket-opt-toggle').textContent = '✅';
    }
  },

  async saveParametres() {
    const btn = document.getElementById('btnSaveParametres');
    const body = {};
    const inputs = document.querySelectorAll('[id^="param_"]');
    inputs.forEach(i => { if (i.dataset.key) body[i.dataset.key] = i.value; });

    document.querySelectorAll('.ticket-option').forEach(el => {
      const key = el.id.substring(5);
      body[key] = el.classList.contains('active') ? '1' : '0';
    });

    body['feature_tables'] = '0';
    body['feature_kds'] = '0';

    if (btn) UI.btnLoading(btn, true, 'Enregistrement...');

    try {
      await api('/parametres', { method: 'PUT', body });
      state.params = await api('/parametres');
      UI.toast('✅ Paramètres enregistrés', 'success');
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
      if (btn) UI.btnLoading(btn, false);
    }
  },

  previewTicket() {
    const demoOrder = {
      numero: 'CMD-PREVIEW-0001',
      sous_total: 45.50,
      total_tva: 4.55,
      remise: 0,
      total: 50.05,
      mode_paiement: 'especes',
      montant_recu: 100,
      monnaie_rendue: 49.95,
      points_gagnes: 50,
      caissier_nom: 'Admin',
      client_nom: 'Client Fidèle',
      type_commande: 'sur_place',
      lignes: [
        { nom_produit: 'Baguette Tradition', quantite: 2, prix_unitaire_ttc: 3.50, sous_total_ttc: 7.00, taux_tva: 0 },
        { nom_produit: 'Croissant', quantite: 3, prix_unitaire_ttc: 4.00, sous_total_ttc: 12.00, taux_tva: 10 },
        { nom_produit: 'Café Latte', quantite: 1, prix_unitaire_ttc: 15.00, sous_total_ttc: 15.00, taux_tva: 10 },
        { nom_produit: 'Sandwich Poulet', quantite: 1, prix_unitaire_ttc: 28.00, sous_total_ttc: 28.00, taux_tva: 10 },
      ]
    };
    const prev = POS.lastOrder;
    POS.lastOrder = demoOrder;

    const tempParams = { ...state.params };
    document.querySelectorAll('[id^="topt_"]').forEach(el => {
      const key = el.id.replace('topt_', '');
      tempParams[key] = el.classList.contains('active') ? '1' : '0';
    });
    const paramInputs = document.querySelectorAll('[id^="param_"]');
    paramInputs.forEach(i => { if (i.dataset.key) tempParams[i.dataset.key] = i.value; });
    const prevParams = state.params;
    state.params = tempParams;

    POS.printLastTicket();

    POS.lastOrder = prev;
    state.params = prevParams;
  },

  async loadBackups() {
    UI.viewLoading('adminBody');
    try {
      const backups = await api('/backup/list');
      const body = document.getElementById('adminBody');
      body.innerHTML = `
        <div class="card mb-16">
           <h3 class="mb-8">📦 Gestion des Sauvegardes</h3>
           <p class="text-muted mb-16">Les sauvegardes manuelles et automatiques sont stockées localement. L'archivage légal génère un dossier conforme aux normes DGI.</p>
           <div style="display:flex;gap:12px">
             <button class="btn btn-primary" onclick="ADMIN.createBackup()">💾 Backup Rapide</button>
             <button class="btn btn-outline" onclick="ADMIN.createArchive()">⚖️ Archive Légale (DGI)</button>
           </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Fichier</th><th>Date</th><th>Taille</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>
              ${backups.map(b => `<tr>
                 <td style="font-family:monospace">${b.filename}</td>
                 <td>${new Date(b.created).toLocaleString()}</td>
                 <td>${(b.size / 1024 / 1024).toFixed(2)} MB</td>
                 <td><span class="badge ${b.filename.includes('archive') ? 'badge-info' : 'badge-success'}">${b.filename.includes('archive') ? 'DGI' : 'SQL'}</span></td>
                 <td class="actions">
                    <button class="btn btn-sm btn-outline" onclick="ADMIN.downloadBackup('${b.filename}')" title="Télécharger">⬇️</button>
                    <button class="btn btn-sm btn-outline" onclick="ADMIN.verifyBackup('${b.filename}')" title="Vérifier intégrité">🔍</button>
                 </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { UI.toast('Erreur charge backups: ' + e.message, 'error'); }
  },

  async createBackup() {
    try {
      if (!await UI.confirmDialog('Créer un backup ?', 'Cela peut prendre quelques secondes.')) return;
      await api('/backup', { method: 'POST' });
      UI.toast('✅ Backup créé', 'success');
      this.loadBackups();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  async createArchive() {
    try {
      if (!await UI.confirmDialog('Générer Archive Légale ?', 'Cette opération gèle les données et signe les fichiers.', { icon: '⚖️' })) return;
      UI.viewLoading('adminBody');
      await api('/backup/archive', { method: 'POST' });
      UI.toast('✅ Archive DGI générée', 'success');
      this.loadBackups();
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); this.loadBackups(); }
  },

  async verifyBackup(filename) {
    try {
      const res = await api('/backup/verify', { method: 'POST', body: { filename } });
      if (res.valid) UI.toast('✅ Backup intègre (SHA256 validé)', 'success');
      else UI.toast('❌ Backup corrompu !', 'error');
    } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
  },

  downloadBackup(filename) {
    window.open(`${API}/backup/download/${filename}?token=${state.token}`, '_blank');
  },

  async resetDatabase() {
    const mode = document.getElementById('resetMode').value;
    const confirmCode = await APP.prompt(`⚠️ ACTION IRRÉVERSIBLE ⚠️`, `Pour confirmer la suppression de TOUTES les données et le passage en mode ${mode.toUpperCase()}, écrivez "RESET-DANGER" ci-dessous :`);
    if (confirmCode !== 'RESET-DANGER') return UI.toast('Annulé : Code de confirmation incorrect', 'info');

    const doubleCheck = await UI.confirmDialog('Êtes-vous ABSOLUMENT sûr ?', 'Toutes les données commerciales seront perdues.', { danger: true, confirmText: 'OUI, TOUT EFFACER' });
    if (!doubleCheck) return;

    UI.viewLoading('adminBody');
    try {
      await api('/admin/reset-database', { method: 'POST', body: { mode, confirmation: 'RESET-DANGER' } });
      alert('✅ Base de données réinitialisée avec succès !\n\nL\'application va maintenant se recharger avec le nouveau profil métier.');
      window.location.reload();
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
      this.loadParametres();
    }
  }
};
