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
            this._loadTodayKPI(),
            this._loadDLCWidget(),
            this._loadDebtWidget()
        ]);
    },

    async _loadTodayKPI() {
        const kpi = document.getElementById('dashTodayKPI');
        if (!kpi) return;
        // Admin/manager only (endpoint is adminOnly)
        const role = state.user && state.user.role;
        if (role !== 'admin' && role !== 'manager') { kpi.style.display = 'none'; return; }

        try {
            const today = new Date().toISOString().slice(0, 10);
            const data = await api(`/stats/jour?date=${today}`);
            const ca = Number(data.total_ventes || 0);
            const nb = Number(data.nb_commandes || 0);
            const moyen = Number(data.panier_moyen || 0);
            const devise = (state.params && state.params.monnaie) || 'DH';
            const fmt = (n) => n.toFixed(2) + ' ' + devise;
            kpi.style.display = 'grid';
            kpi.innerHTML = `
                <div class="dash-kpi-card">
                    <div class="dash-kpi-label">CA du jour</div>
                    <div class="dash-kpi-value" aria-live="polite">${fmt(ca)}</div>
                </div>
                <div class="dash-kpi-card">
                    <div class="dash-kpi-label">Tickets</div>
                    <div class="dash-kpi-value">${nb}</div>
                </div>
                <div class="dash-kpi-card">
                    <div class="dash-kpi-label">Panier moyen</div>
                    <div class="dash-kpi-value">${fmt(moyen)}</div>
                </div>
            `;
        } catch (e) {
            kpi.style.display = 'none';
        }
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
                <button class="btn btn-sm btn-outline" data-action="APP.navigate" data-param="/stock/dlc" style="white-space:nowrap">Voir →</button>
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
                <button class="btn btn-sm btn-outline" data-action="APP.navigate" data-param="/stats/credits" style="white-space:nowrap">Voir →</button>
            `;
        } catch (e) {
            widget.style.display = 'none';
        }
    },

    goToPOS() { APP.navigate('/pos'); },
    goToHistory() { APP.navigate('/history'); },
    goToProducts() { APP.navigate('/admin/produits'); },
    goToStock() { APP.navigate('/stock'); },
    goToClients() { APP.navigate('/clients'); },
    goToStats() { APP.navigate('/stats'); },
    goToAdmin() { APP.navigate('/admin'); },

    openCaisseModal() {
        APP.navigate('/pos');
        setTimeout(() => APP.openCaisseModal(), 300);
    },
};

window.DASHBOARD = DASHBOARD;
