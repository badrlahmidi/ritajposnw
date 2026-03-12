import { APP } from '../core/app.js';
import { api } from '../core/api.js';
import { state } from '../core/state.js';
import { ADMIN } from './admin.js';

export const DASHBOARD = {
    show() {
        document.getElementById('dashboardScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';

        const nameEl = document.getElementById('dashUserName');
        if (nameEl && state.user) {
            nameEl.textContent = `${state.user.prenom || ''} ${state.user.nom}`.trim();
        }

        // Charger les widgets d'alerte en arrière-plan
        this._loadAlertWidgets();
    },

    async _loadAlertWidgets() {
        await Promise.allSettled([
            this._loadDLCWidget(),
            this._loadDebtWidget()
        ]);
    },

    async _loadDLCWidget() {
        const widget = document.getElementById('dashDLCWidget');
        if (!widget) return;

        if (state.params.feature_dlc !== '1') {
            widget.style.display = 'none';
            return;
        }

        try {
            const alertes = await api('/produits/dlc/alertes?jours=7');
            if (!alertes || alertes.length === 0) {
                widget.style.display = 'none';
                return;
            }
            const danger = alertes.filter(a => a.jours_restants <= 3).length;
            const warning = alertes.filter(a => a.jours_restants > 3).length;
            widget.style.display = 'flex';
            widget.innerHTML = `
                <div class="dash-alert-icon">⚠️</div>
                <div class="dash-alert-body">
                    <div class="dash-alert-title">${alertes.length} produit(s) proche(s) de péremption</div>
                    <div class="dash-alert-sub">
                        ${danger > 0 ? `<span style="color:#e74c3c;font-weight:600">🔴 ${danger} critique(s) (&lt;3j)</span>` : ''}
                        ${warning > 0 ? `<span style="color:#e67e22;font-weight:600">🟡 ${warning} à surveiller</span>` : ''}
                    </div>
                </div>
                <button class="btn btn-sm btn-outline" onclick="APP.enterMainApp('stock');setTimeout(()=>STOCK.showAlertesDLC(),300)" style="white-space:nowrap">Voir →</button>
            `;
        } catch (e) {
            widget.style.display = 'none';
        }
    },

    async _loadDebtWidget() {
        const widget = document.getElementById('dashDebtWidget');
        if (!widget) return;

        if (state.params.feature_credit !== '1') {
            widget.style.display = 'none';
            return;
        }

        try {
            const data = await api('/stats/credits');
            const total = data ? data.total_global || 0 : 0;
            const nb = data && data.clients ? data.clients.length : 0;
            if (nb === 0 || total === 0) {
                widget.style.display = 'none';
                return;
            }
            widget.style.display = 'flex';
            widget.innerHTML = `
                <div class="dash-alert-icon">📒</div>
                <div class="dash-alert-body">
                    <div class="dash-alert-title">${nb} client(s) avec ardoise</div>
                    <div class="dash-alert-sub"><span style="color:#e74c3c;font-weight:700">${total.toFixed(2)} DH</span> en encours total</div>
                </div>
                <button class="btn btn-sm btn-outline" onclick="APP.enterMainApp('stats');setTimeout(()=>STATS.switchReport('credits'),300)" style="white-space:nowrap">Voir →</button>
            `;
        } catch (e) {
            widget.style.display = 'none';
        }
    },

    goToPOS() { APP.enterMainApp('pos'); },
    goToHistory() { APP.enterMainApp('history'); },
    goToProducts() { APP.enterMainApp('admin'); setTimeout(() => ADMIN.switchTab('produits'), 100); },
    goToStock() { APP.enterMainApp('stock'); },
    goToClients() { APP.enterMainApp('clients'); },
    goToStats() { APP.enterMainApp('stats'); },
    goToAdmin() { APP.enterMainApp('admin'); },

    openCaisseModal() {
        APP.enterMainApp('pos');
        setTimeout(() => APP.openCaisseModal(), 300);
    },
};

window.DASHBOARD = DASHBOARD;
