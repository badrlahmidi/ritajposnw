import { POS } from './pos.js';
import { state } from '../core/state.js';

export const SHORTCUTS = {
    init() {
        let barcodeBuffer = '';
        let lastKeyTime = Date.now();

        document.addEventListener('keypress', (e) => {
            if (!state.user) return;
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

            const now = Date.now();
            if (now - lastKeyTime > 50) {
                barcodeBuffer = '';
            }
            if (e.key === 'Enter') {
                if (barcodeBuffer.length >= 3) {
                    e.preventDefault();
                    POS.scanBarcode(barcodeBuffer);
                }
                barcodeBuffer = '';
            } else if (e.key.length === 1) {
                barcodeBuffer += e.key;
            }
            lastKeyTime = now;
        });

        document.addEventListener('keydown', (e) => {
            if (!state.user) return;
            if (e.key === 'F2') {
                e.preventDefault();
                const el = document.getElementById('searchInput');
                if (el) el.focus();
            }
            if (e.key === 'F4') {
                e.preventDefault();
                if (document.getElementById('paymentModal').style.display === 'flex') {
                    POS.pmValidate('especes');
                } else {
                    POS.openPaymentModal();
                }
            }
            if (e.key === 'F5') {
                e.preventDefault();
                if (document.getElementById('paymentModal').style.display === 'flex') {
                    POS.pmValidate('carte');
                } else {
                    POS.openPaymentModal();
                    // Optional: pre-select card logic if needed
                }
            }
            if (e.key === 'F8') {
                e.preventDefault();
                POS.clearCart();
            }
            if (e.key === 'Escape') {
                // Close modals
                document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
                document.querySelectorAll('.confirm-overlay').forEach(m => m.remove());
                const dd = document.getElementById('userDropdown');
                if (dd) dd.style.display = 'none';
            }
            if (e.key === '?' && !e.target.matches('input, textarea, select')) {
                e.preventDefault();
                this.showHelp();
            }
        });
    },

    showHelp() {
        const div = document.createElement('div');
        div.className = 'modal-overlay';
        div.style.display = 'flex';
        div.style.zIndex = '10000';
        div.innerHTML = `
      <div class="modal-content" style="max-width:400px">
        <div class="modal-header">
          <h2>⌨️ Raccourcis Clavier</h2>
          <button class="close-modal" onclick="this.parentElement.parentElement.parentElement.remove()">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:1.1rem">
            <div style="font-weight:bold">F2</div><div>🔍 Rechercher produit</div>
            <div style="font-weight:bold">F4</div><div>💵 Paiement Espèces</div>
            <div style="font-weight:bold">F5</div><div>💳 Paiement Carte</div>
            <div style="font-weight:bold">F8</div><div>🗑️ Vider le panier</div>
            <div style="font-weight:bold">ESC</div><div>❌ Fermer fenêtre</div>
            <div style="font-weight:bold">?</div><div>ℹ️ Aide raccourcis</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-block" onclick="this.parentElement.parentElement.parentElement.remove()">Fermer</button>
        </div>
      </div>
    `;
        document.body.appendChild(div);
    }
};

window.showShortcutsModal = SHORTCUTS.showHelp; // Global alias
