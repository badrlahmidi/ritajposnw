// Waiter Interface - Logic JavaScript
// Gère la communication avec l'API, la gestion de la commande et l'affichage

document.addEventListener('DOMContentLoaded', function() {
  // État de l'application
  let state = {
    currentTable: null,
    currentCategory: 1,
    orderLines: [],
    totalTTC: 0
  };

  // API de base
  const API_BASE = '/waiter';

  // Initialiser l'interface au chargement
  initInterface();

  // --- Initialisation ---

  async function initInterface() {
    await chargerTables();
    chargerCategories();
    rafraîchirTables();
    // Mise à jour toutes les 3 secondes pour refléter les changements
    setInterval(rafraîchirTables, 3000);
  }

  // --- Gestion des Tables ---

  async function chargerTables() {
    try {
      const response = await fetch(`${API_BASE}/tables`);
      const data = await response.json();
      
      if (data.success && data.tables) {
        afficherTables(data.tables);
      }
    } catch (err) {
      console.error('Erreur chargement tables:', err);
    }
  }

  function afficherTables(tables) {
    const grid = document.getElementById('tablesGrid');
    grid.innerHTML = tables.map(table => `
      <div class="table-card" data-table-id="${table.id}" data-table-numero="${table.numero}" 
           onclick="selectionnerTable(${table.id}, ${table.numero})"
           style="cursor: pointer;">
        <div class="table-number">${table.numero}</div>
        <div class="table-status ${table.actif ? 'actif' : 'fermee'}">
          ${table.actif ? 'Ouverte' : 'Fermee'}
        </div>
      </div>
    `).join('');
  }

  function selectionnerTable(id, numero) {
    state.currentTable = id;
    
    // Mise à jour de l'UI des tables
    document.querySelectorAll('.table-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.tableId == id);
    });

    document.getElementById('table-status').textContent = `Table: ${numero}`;
    
    // Vider la commande actuelle et en créer une nouvelle pour cette table
    viderCommande();
    chargerCommandeVide();
    
    // Note: en production, on récupèrerait l'ancienne commande en cours
    // et on la chargerait, mais pour simplifier on crée une nouvelle commande
  }

  // --- Gestion des Catégories ---

  function chargerCategories() {
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', function() {
        // Mise à jour visuelle
        buttons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        state.currentCategory = parseInt(this.dataset.categorie);
        // Ici, on pourrait filtrer les produits par catégorie
        // pour l'instant, on affiche tous les produits
      });
    });
  }

  // --- Gestion de la Commande ---

  async function viderCommande() {
    state.orderLines = [];
    state.totalTTC = 0;
    renderOrder();
    document.getElementById('order-empty').style.display = 'block';
    document.getElementById('order-active').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'none';
    document.querySelector('.btn-print').disabled = true;
    document.querySelector('.btn-payer').disabled = true;
  }

  function renderOrder() {
    const orderEmpty = document.getElementById('order-empty');
    const orderActive = document.getElementById('order-active');
    const orderItems = document.getElementById('order-items');
    const totalTTC = document.getElementById('total-ttc');
    const totalTTCPaiement = document.getElementById('total-ttc-paiement');

    orderEmpty.style.display = state.orderLines.length === 0 ? 'block' : 'none';
    orderActive.style.display = state.orderLines.length > 0 ? 'block' : 'none';

    orderItems.innerHTML = state.orderLines.map((ligne, index) => `
      <div class="order-line">
        <span class="order-line-name">${ligne.nom}</span>
        <span class="order-line-qte">${ligne.quantite}x</span>
        <span class="order-line-prix">${formatMontant(ligne.prixTTC)}</span>
        <button class="btn-remove" onclick="supprimerLigne(${index})">×</button>
      </div>
    `).join('');

    totalTTC.textContent = formatMontant(state.totalTTC);
    totalTTCPaiement.textContent = formatMontant(state.totalTTC);

    // Activer/désactiver les boutons
    const btnPrint = document.querySelector('.btn-print');
    const btnPayer = document.querySelector('.btn-payer');
    const orderActive = document.getElementById('order-active');

    if (state.orderLines.length > 0) {
      btnPrint.disabled = false;
      btnPayer.disabled = false;
      orderActive.style.display = 'block';
      orderEmpty.style.display = 'none';
    } else {
      btnPrint.disabled = true;
      btnPayer.disabled = true;
    }
  }

  function formatMontant(montant) {
    return montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Actions API ---

  // Ajouter un produit à la commande
  window.ajouterProduit = async function(produitId, nom, prix) {
    try {
      const response = await fetch(`${API_BASE}/ajouter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          produitId,
          quantite: 1,
          categorieId: state.currentCategory
        }),
        credentials: 'same-origin'
      });

      const result = await response.json();
      
      if (result.success) {
        // Mettre à jour l'état local
        const ligneExistante = state.orderLines.find(l => l.produitId === produitId);
        if (ligneExistante) {
         ligneExistante.quantite++;
        } else {
          state.orderLines.push({
            produitId,
            nom,
            quantite: 1,
            prixHT: prix,
            prixTTC: prix
          });
        }
        state.totalTTC += prix;
        renderOrder();
      } else {
        alert(result.error || 'Erreur ajout produit');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur réseau lors de l\'ajout du produit');
    }
  };

  // Supprimer une ligne de commande
  window.supprimerLigne = function(index) {
    const ligne = state.orderLines[index];
    if (confirm(`Voulez-vous supprimer ${ligne.nom} (${ligne.quantite}x) de la commande?`)) {
      state.totalTTC -= ligne.prixTTC;
      state.orderLines.splice(index, 1);
      renderOrder();
    }
  };

  // Passer au règlement
  window.executerReglement = async function() {
    if (state.orderLines.length === 0) {
      alert('Aucune commande en cours');
      return;
    }

    const modePaiement = document.querySelector('input[name="mode-paiement"]:checked')?.value || 'especes';
    
    try {
      const response = await fetch(`${API_BASE}/regler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modePaiement,
          orderId: Date.now() // Utilisation de l'ID de l'ordre courant
        }),
        credentials: 'same-origin'
      });

      const result = await response.json();
      
      if (result.success) {
        // Réinitialiser l'interface
        viderCommande();
        
        // Afficher un message de confirmation
        alert(`Commande réglée avec succès - Total: ${formatMontant(result.totalTTC)} - Mode: ${result.modePaiement}`);
        
        // Rafraîchir les tables
        rafraîchirTables();
      } else {
        alert(result.error || 'Erreur lors du règlement');
      }
    } catch (err) {
      console.error('Erreur règlement:', err);
      alert('Erreur réseau lors du règlement');
    }
  };

  // Imprimer le receipt
  window.printReceipt = function() {
    if (state.orderLines.length === 0) {
      alert('Aucune commande à imprimer');
      return;
    }
    
    // En production, ceci appelerait un backend pour générer le PDF/receipt
    // Pour l'instant, on simule l'impression
    const printContent = `
      <h3>RÉCEPÉT - RITAJ POS</h3>
      <p>Table: ${state.currentTable || 'Non spécifiée'}</p>
      <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
      <hr>
      <table>
        <tr><th>Article</th><th>Qté</th><th>Prix TTC</th></tr>
        ${state.orderLines.map(l => `<tr><td>${l.nom}</td><td>${l.quantite}x</td><td>${formatMontant(l.prixTTC)}</td></tr>`).join('')}
      </table>
      <hr>
      <p>Sous-total: ${formatMontant(state.totalTTC)}</p>
      <p>Mode paiement: Espèces</p>
      <p>Remerciement: Merci pour votre visite!</p>
    </div>`;

    // Ouvrir une nouvelle fenêtre pour impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // --- Rafraîchissement des tables ---

  async function rafraîchirTables() {
    try {
      const response = await fetch(`${API_BASE}/tables`);
      const data = await response.json();
      
      if (data.success && data.tables) {
        // Mettre à jour le statut de la table sélectionnée
        if (state.currentTable) {
          const tableCard = document.querySelector(`[data-table-id="${state.currentTable}"]`);
          if (tableCard) {
            const statusCell = tableCard.querySelector('.table-status');
            const tableData = data.tables.find(t => t.id == state.currentTable);
            if (tableData) {
              statusCell.textContent = tableData.actif ? 'Ouverte' : 'Fermee';
              statusCell.className = `table-status ${tableData.actif ? 'actif' : 'fermee'}`;
            }
          }
        }
        
        // Mettre à jour toutes les autres tables
        document.querySelectorAll('.table-card').forEach(card => {
          const tableId = parseInt(card.dataset.tableId);
          const tableData = data.tables.find(t => t.id == tableId);
          if (tableData) {
            const statusCell = card.querySelector('.table-status');
            statusCell.textContent = tableData.actif ? 'Ouverte' : 'Fermee';
            statusCell.className = `table-status ${tableData.actif ? 'actif' : 'fermee'}`;
          }
        });
      }
    } catch (err) {
      // Silently fail - pas de panique si le rafraîchissement échoue
    }
  }
});