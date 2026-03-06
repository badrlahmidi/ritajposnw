import { api, API } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

export const STATS = {
  currentReport: 'synthese',
  lastData: null,

  async init() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('statsDate').value = today;
    document.getElementById('statsDateFin').value = today;

    try {
      const users = await api('/utilisateurs');
      const cats = await api('/categories');

      const uSelect = document.getElementById('statsUser');
      const cSelect = document.getElementById('statsCat');

      uSelect.innerHTML = '<option value="">Tous les caissiers</option>' +
        users.map(u => `<option value="${u.id}">${u.nom}</option>`).join('');

      cSelect.innerHTML = '<option value="">Toutes les catégories</option>' +
        cats.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');
    } catch (e) { }

    this.switchReport('synthese');
  },

  switchReport(type) {
    this.currentReport = type;
    document.querySelectorAll('.report-menu-item').forEach(el => {
      el.classList.toggle('active', el.dataset.report === type);
    });

    const dFin = document.getElementById('statsDateFin');
    const multiDate = ['synthese', 'categories', 'utilisateurs', 'paiements', 'marges', 'audit'].includes(type);
    dFin.style.display = multiDate ? '' : 'none';

    this.load();
  },

  async load() {
    UI.viewLoading('statsBody');
    const dateDeb = document.getElementById('statsDate').value;
    const dateFin = document.getElementById('statsDateFin').value;
    const userId = document.getElementById('statsUser').value;
    const catId = document.getElementById('statsCat').value;

    let url = '';
    const params = `?date_debut=${dateDeb}&date_fin=${dateFin}&utilisateur_id=${userId}&categorie_id=${catId}`;

    try {
      if (this.currentReport === 'synthese') {
        url = dateDeb === dateFin ? `/stats/jour?date=${dateDeb}&utilisateur_id=${userId}&categorie_id=${catId}` : `/stats/periode${params}`;
      } else if (this.currentReport === 'categories') {
        url = `/stats/categories${params}`;
      } else if (this.currentReport === 'utilisateurs') {
        url = `/stats/utilisateurs${params}`;
      } else if (this.currentReport === 'paiements') {
        url = `/stats/paiements${params}`;
      } else if (this.currentReport === 'marges') {
        url = `/stats/marges${params}`;
      } else if (this.currentReport === 'credits') {
        url = `/stats/credits`;
      } else if (this.currentReport === 'tva') {
        url = `/stats/z?date=${dateDeb}`;
      } else if (this.currentReport === 'stock-valorisation') {
        url = `/stats/stock/valorisation`;
      } else if (this.currentReport === 'stock-alertes') {
        url = `/stats/stock/alertes`;
      } else if (this.currentReport === 'audit') {
        url = `/stats/audit${params}`;
      }

      this.lastData = await api(url);
      this.render();
    } catch (e) {
      document.getElementById('statsBody').innerHTML = `<div class="p-20 text-danger">Erreur: ${e.message}</div>`;
    }
  },

  render() {
    const body = document.getElementById('statsBody');
    const data = this.lastData;
    const dev = state.params.devise || 'DH';
    const type = this.currentReport;

    if (type === 'synthese') this.renderSynthese(data, dev, body);
    else if (type === 'categories') this.renderCategories(data, dev, body);
    else if (type === 'utilisateurs') this.renderUtilisateurs(data, dev, body);
    else if (type === 'paiements') this.renderPaiements(data, dev, body);
    else if (type === 'marges') this.renderMarges(data, dev, body);
    else if (type === 'credits') this.renderCredits(data, dev, body);
    else if (type === 'tva') this.renderTVA(data, dev, body);
    else if (type === 'stock-valorisation') this.renderStockValorisation(data, dev, body);
    else if (type === 'stock-alertes') this.renderStockAlertes(data, dev, body);
    else if (type === 'audit') this.renderAudit(data, dev, body);
  },

  renderSynthese(s, dev, body) {
    body.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card mini"><div class="stat-value">${s.nb_commandes || 0}</div><div class="stat-label">Commandes</div></div>
        <div class="stat-card mini success"><div class="stat-value">${(s.total_ventes || 0).toFixed(2)} ${dev}</div><div class="stat-label">Ventes TTC</div></div>
        <div class="stat-card mini info"><div class="stat-value">${(s.total_ht || 0).toFixed(2)} ${dev}</div><div class="stat-label">Total HT</div></div>
        <div class="stat-card mini warning"><div class="stat-value">${(s.total_tva || 0).toFixed(2)} ${dev}</div><div class="stat-label">Total TVA</div></div>
        <div class="stat-card mini danger"><div class="stat-value">${(s.total_depenses || 0).toFixed(2)} ${dev}</div><div class="stat-label">Dépenses</div></div>
        <div class="stat-card mini ${(s.benefice_brut || 0) >= 0 ? 'success' : 'danger'}"><div class="stat-value">${(s.benefice_brut || 0).toFixed(2)} ${dev}</div><div class="stat-label">Bénéfice Brut</div></div>
      </div>
      <div class="report-chart-container">
        <h3 class="mb-16">📈 Évolution des ventes</h3>
        <div class="hour-chart">${s.ventes_par_heure ? this.renderHourChart(s.ventes_par_heure) : s.ventes_par_jour ? this.renderDayChart(s.ventes_par_jour) : ''}</div>
      </div>
      
      <div class="card mt-20">
        <h3 class="mb-16">🏆 Top 10 Best Sellers</h3>
        <div style="display:flex;align-items:flex-end;height:200px;gap:10px;padding:10px 0;margin-bottom:20px;overflow-x:auto">
            ${(s.top_produits || []).slice(0, 10).map((p, i) => {
      const max = s.top_produits[0]?.total_montant || 1;
      const h = Math.max(10, (p.total_montant / max) * 100);
      const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#16a085', '#d35400', '#7f8c8d', '#c0392b'];
      return `<div style="flex:1;min-width:60px;display:flex;flex-direction:column;align-items:center;height:100%">
                    <div style="margin-top:auto;width:100%;background:${colors[i % colors.length]};height:${h}%;border-radius:4px 4px 0 0;position:relative;transition:height 0.3s" title="${p.nom}: ${p.total_montant} DH">
                        <span style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:0.8rem;font-weight:bold">${Math.round(p.total_montant)}</span>
                    </div>
                    <div style="margin-top:5px;font-size:0.75rem;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%">${p.nom.substring(0, 8)}</div>
                </div>`;
    }).join('') || '<div class="text-muted w-100 text-center" style="align-self:center">Pas de données</div>'}
        </div>
      </div>
      <div class="card mt-20">
        <h3 class="mb-16">🏆 Top Produits</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Produit</th><th>Quantité</th><th>Total TTC</th></tr></thead>
            <tbody>${(s.top_produits || []).map(p => `<tr><td>${p.nom}</td><td>${p.total_qte}</td><td>${p.total_montant.toFixed(2)} ${dev}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderCategories(data, dev, body) {
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">📂 Ventes par Catégorie</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Catégorie</th><th>Articles vendus</th><th>Quantité totale</th><th>Total TTC</th></tr></thead>
            <tbody>${data.map(c => `<tr><td><strong>${c.categorie}</strong></td><td>${c.nb_articles}</td><td>${c.total_qte}</td><td><strong>${c.total_ttc.toFixed(2)} ${dev}</strong></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderUtilisateurs(data, dev, body) {
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">👤 Performance des Caissiers</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Caissier</th><th>N° Commandes</th><th>Panier Moyen</th><th>Total Ventes</th></tr></thead>
            <tbody>${data.map(u => `<tr><td><strong>${u.utilisateur}</strong></td><td>${u.nb_commandes}</td><td>${u.panier_moyen.toFixed(2)} ${dev}</td><td><strong>${u.total_ventes.toFixed(2)} ${dev}</strong></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderPaiements(data, dev, body) {
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">💳 Journal des Paiements</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Mode de paiement</th><th>Transactions</th><th>Moyenne</th><th>Total Encaissement</th></tr></thead>
            <tbody>${data.map(p => `<tr><td><strong>${p.mode_paiement.toUpperCase()}</strong></td><td>${p.nb}</td><td>${p.moyenne.toFixed(2)} ${dev}</td><td><strong>${p.montant.toFixed(2)} ${dev}</strong></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderMarges(data, dev, body) {
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">📈 Marges & Profitabilité</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Produit</th><th>Qté</th><th>CA HT</th><th>Coût Total</th><th>Marge Brute</th></tr></thead>
            <tbody>${data.map(m => `<tr><td>${m.nom}</td><td>${m.qte}</td><td>${m.ca_ht.toFixed(2)}</td><td>${m.total_cout.toFixed(2)}</td><td class="${m.marge_brute >= 0 ? 'text-success' : 'text-danger'}"><strong>${m.marge_brute.toFixed(2)} ${dev}</strong></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderCredits(data, dev, body) {
    body.innerHTML = `
        <div class="stat-card danger mb-16" style="max-width:300px">
          <div class="stat-value">${(data.total_global || 0).toFixed(2)} ${dev}</div>
          <div class="stat-label">Encours Clients Global</div>
        </div>
        <div class="card">
          <h3 class="mb-16">🏧 Détail des Crédits Clients</h3>
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr><th>Client</th><th>Téléphone</th><th>Dernière Op</th><th>Solde Actuel</th></tr></thead>
              <tbody>${data.clients.map(c => `<tr>
                <td><strong>${c.nom}</strong></td>
                <td>${c.telephone || '—'}</td>
                <td>${c.derniere_op ? new Date(c.derniere_op).toLocaleDateString() : '—'}</td>
                <td class="text-danger"><strong>${c.solde_credit.toFixed(2)} ${dev}</strong></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>`;
  },

  renderTVA(data, dev, body) {
    const list = data.tva || [];
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">🧾 Récapitulatif TVA</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Taux TVA</th><th>Base HT</th><th>Montant TVA</th><th>Total TTC</th></tr></thead>
            <tbody>${list.map(t => `<tr><td>${t.taux_tva}%</td><td>${t.base_ht.toFixed(2)}</td><td>${t.montant.toFixed(2)}</td><td><strong>${(t.base_ht + t.montant).toFixed(2)} ${dev}</strong></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderStockValorisation(data, dev, body) {
    body.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card mini"><div class="stat-value">${data.nb_produits || 0}</div><div class="stat-label">Produits actifs</div></div>
        <div class="stat-card mini"><div class="stat-value">${(data.total_unites || 0).toFixed(0)}</div><div class="stat-label">Unités en stock</div></div>
        <div class="stat-card mini info"><div class="stat-value">${(data.valeur_achat || 0).toFixed(2)} ${dev}</div><div class="stat-label">Valeur (Achat)</div></div>
        <div class="stat-card mini success"><div class="stat-value">${(data.valeur_vente_ttc || 0).toFixed(2)} ${dev}</div><div class="stat-label">Valeur (Vente TTC)</div></div>
        <div class="stat-card mini warning"><div class="stat-value">${((data.valeur_vente_ht || 0) - (data.valeur_achat || 0)).toFixed(2)} ${dev}</div><div class="stat-label">Marge Latente HT</div></div>
      </div>`;
  },

  renderStockAlertes(data, dev, body) {
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">⚠️ Produits en rupture ou stock bas</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Produit</th><th>Catégorie</th><th>Stock Actuel</th><th>Seuil</th><th>État</th></tr></thead>
            <tbody>${data.map(i => `<tr>
              <td><strong>${i.nom}</strong></td>
              <td>${i.categorie || '—'}</td>
              <td class="${i.quantite <= 0 ? 'text-danger' : 'text-warning'}"><strong>${i.quantite} ${i.unite}</strong></td>
              <td>${i.seuil_alerte}</td>
              <td><span class="badge badge-${i.quantite <= 0 ? 'danger' : 'warning'}">${i.quantite <= 0 ? 'Rupture' : 'Bas'}</span></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderAudit(data, dev, body) {
    body.innerHTML = `
      <div class="card">
        <h3 class="mb-16">🔍 Journal d'Audit Système</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th></tr></thead>
            <tbody>${data.map(a => `<tr>
              <td><small>${new Date(a.date_action).toLocaleString()}</small></td>
              <td><strong>${a.utilisateur_nom}</strong></td>
              <td><span class="badge badge-info">${a.action}</span></td>
              <td>${a.entite} #${a.entite_id || ''}</td>
              <td><small>${a.details || ''}</small></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  renderHourChart(data) {
    const max = Math.max(...data.map(d => d.montant), 1);
    return data.map(d => {
      const h = Math.max(4, (d.montant / max) * 100);
      return `<div class="hour-bar" style="height:${h}%" title="${d.heure}h: ${parseFloat(d.montant).toFixed(0)} DH (${d.nb} cmd)">
        <span class="hour-val">${d.nb}</span><span class="hour-label">${d.heure}h</span>
      </div>`;
    }).join('');
  },

  renderDayChart(data) {
    const max = Math.max(...data.map(d => d.montant), 1);
    return data.map(d => {
      const h = Math.max(4, (d.montant / max) * 100);
      return `<div class="hour-bar" style="height:${h}%" title="${d.jour}: ${parseFloat(d.montant).toFixed(0)} DH">
        <span class="hour-val">${d.nb}</span><span class="hour-label">${d.jour.slice(5)}</span>
      </div>`;
    }).join('');
  },

  exportCSV() {
    const type = this.currentReport;
    const data = this.lastData;
    if (!data) return UI.toast('Aucune donnée à exporter', 'warning');

    let csv = 'data:text/csv;charset=utf-8,';
    let rows = [];

    if (type === 'synthese') {
      rows = [['Metrique', 'Valeur'], ['Commandes', data.nb_commandes], ['Ventes TTC', data.total_ventes], ['Bénéfice Brut', data.benefice_brut]];
    } else if (type === 'categories') {
      rows = [['Categorie', 'Articles', 'Quantite', 'Total TTC'], ...data.map(c => [c.categorie, c.nb_articles, c.total_qte, c.total_ttc])];
    } else if (type === 'utilisateurs') {
      rows = [['Utilisateur', 'Commandes', 'Total Ventes'], ...data.map(u => [u.utilisateur, u.nb_commandes, u.total_ventes])];
    } else if (type === 'marges') {
      rows = [['Produit', 'Quantite', 'CA HT', 'Cout', 'Marge'], ...data.map(m => [m.nom, m.qte, m.ca_ht, m.total_cout, m.marge_brute])];
    } else if (type === 'paiements') {
      rows = [['Mode de Paiement', 'Transactions', 'Total'], ...data.map(p => [p.mode_paiement, p.nb, p.montant])];
    } else if (type === 'credits') {
      rows = [['Client', 'Telephone', 'Solde Credit'], ...data.clients.map(c => [c.nom, c.telephone, c.solde_credit])];
    } else if (type === 'tva') {
      rows = [['Taux TVA', 'Base HT', 'Montant TVA', 'Total TTC'], ...data.tva.map(t => [t.taux_tva, t.base_ht, t.montant, t.total_ttc])];
    } else if (type === 'stock-valorisation') {
      rows = [['Metrique', 'Valeur'], ['Produits Actifs', data.nb_produits], ['Unites en Stock', data.total_unites], ['Valeur Achat', data.valeur_achat], ['Valeur Vente TTC', data.valeur_vente_ttc]];
    } else if (type === 'stock-alertes') {
      rows = [['Produit', 'Categorie', 'Stock Actuel', 'Seuil'], ...data.map(i => [i.nom, i.categorie, i.quantite, i.seuil_alerte])];
    } else if (type === 'audit') {
      rows = [['Date', 'Utilisateur', 'Action', 'Entite', 'Details'], ...data.map(a => [a.date_action, a.utilisateur_nom, a.action, a.entite, a.details])];
    }

    csv += rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rapport_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  printA4() {
    const type = this.currentReport;
    const dateDeb = document.getElementById('statsDate').value;
    const dateFin = document.getElementById('statsDateFin').value;
    const userId = document.getElementById('statsUser').value;
    const catId = document.getElementById('statsCat').value;

    const url = `${API}/stats/export/pdf?type=${type}&date_debut=${dateDeb}&date_fin=${dateFin}&utilisateur_id=${userId}&categorie_id=${catId}&token=${state.token}`;
    window.open(url, '_blank');
  },

  print80mm() {
    const content = document.getElementById('statsBody').innerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');

    const css = `
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 5px; }
      h2, h3 { text-align: center; text-transform: uppercase; font-size: 14px; margin: 10px 0; border-bottom: 1px dashed #000; padding-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; }
      th { border-bottom: 1px solid #000; text-align: left; }
      td { padding: 4px 0; }
      .stats-grid { display: block; }
      .stat-card { border: 1px solid #000; padding: 5px; margin-bottom: 5px; text-align: center; }
      .stat-value { font-size: 16px; font-weight: bold; }
      .badge, .btn, .report-chart-container, .reports-sidebar { display: none !important; }
      .text-danger, .text-warning, .text-success { color: #000 !important; font-weight: bold; }
      @media print { .no-print { display: none; } }
    `;

    win.document.write(`
      <html>
        <head>
          <title>Rapport POS 80mm</title>
          <style>${css}</style>
        </head>
        <body>
          <div style="text-align:center">
            <strong>${state.params.nom_commerce || 'POS'}</strong><br>
            Rapport: ${this.currentReport.toUpperCase()}<br>
            Période: ${document.getElementById('statsDate').value} au ${document.getElementById('statsDateFin').value}
          </div>
          ${content}
          <div style="margin-top:20px; text-align:center; font-size:10px">--- RITAJ SMART POS ---</div>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
      </html>
    `);
    win.document.close();
  }
};
