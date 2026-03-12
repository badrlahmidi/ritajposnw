import { API, api } from './api.js';
import { state, setUser, clearAuth } from './state.js';
import * as UI from './ui.js';
import { POS } from '../modules/pos.js';
import { DASHBOARD } from '../modules/dashboard.js';
import { HISTORY } from '../modules/history.js';
import { CLIENTS } from '../modules/clients.js';
import { LIVRAISON } from '../modules/delivery.js';
import { STOCK } from '../modules/stock.js';
import { STATS } from '../modules/stats.js';
import { ADMIN } from '../modules/admin.js';
import { SETUP } from '../modules/setup.js';
import { NUMPAD } from '../modules/numpad.js';
import { SHORTCUTS } from '../modules/shortcuts.js';

// Expose modules to global scope for HTML event handlers
window.POS = POS;
window.DASHBOARD = DASHBOARD;
window.HISTORY = HISTORY;
window.CLIENTS = CLIENTS;
window.LIVRAISON = LIVRAISON;
window.STOCK = STOCK;
window.STATS = STATS;
window.ADMIN = ADMIN;
window.SETUP = SETUP;
window.NUMPAD = NUMPAD;
window.SHORTCUTS = SHORTCUTS;
// window.APP = APP; // Moved to end of file

export const APP = {
    /* ════════ CUSTOM PROMPT ════════ */
    _promptCallback: null,

    showPrompt(title, message, defaultValue, callback, type = 'text') {
        this._promptCallback = callback;
        document.getElementById('promptTitle').innerText = title;

        // Message
        const msgEl = document.getElementById('promptMessage');
        if (message) {
            msgEl.innerText = message;
            msgEl.style.display = 'block';
        } else {
            msgEl.style.display = 'none';
        }

        // Input
        const input = document.getElementById('promptInput');
        input.value = defaultValue || '';

        // Show correct keyboard
        if (type === 'number') {
            document.getElementById('promptNumpad').style.display = 'grid';
            document.getElementById('promptKeyboard').style.display = 'none';
        } else {
            document.getElementById('promptNumpad').style.display = 'none';
            document.getElementById('promptKeyboard').style.display = 'flex';
        }

        document.getElementById('customPromptModal').style.display = 'flex';
        setTimeout(() => {
            input.focus();
            if (defaultValue) input.select();
        }, 100);
    },

    promptKeyPress(key) {
        const input = document.getElementById('promptInput');
        if (key === 'BACKSPACE') {
            input.value = input.value.slice(0, -1);
        } else if (key === 'SPACE') {
            input.value += ' ';
        } else {
            input.value += key;
        }
        input.focus();
    },

    confirmPrompt() {
        const val = document.getElementById('promptInput').value;
        this.closeModal('customPromptModal');
        if (this._promptCallback) this._promptCallback(val);
        this._promptCallback = null;
    },

    cancelPrompt() {
        this.closeModal('customPromptModal');
        if (this._promptCallback) this._promptCallback(null);
        this._promptCallback = null;
    },

    prompt(title, message = '', defaultValue = '', type = 'text') {
        return new Promise((resolve) => {
            this.showPrompt(title, message, defaultValue, (val) => {
                resolve(val);
            }, type);
        });
    },

    currentView: 'pos',

    async init() {
        // 0. CHECK RECOVERY (Critical)
        this.updateClock();
        setInterval(() => this.updateClock(), 30000);

        // 0. CHECK RECOVERY (Critical)
        try {
            if (await this.checkRecoveryStatus()) return;
        } catch (e) { console.error('Recovery check failed', e); }

        this.setupTheme();
        this.setupTheme();
        this.setupVirtualNumpad();
        SHORTCUTS.init();

        // 1. SETUP STATUS
        try {
            const setupStatus = await fetch(`${API}/setup/status`).then(r => r.json());
            if (!setupStatus.completed) return SETUP.start();
        } catch (e) { console.warn('Erreur vérification setup:', e); }

        // 2. PARAMS & AUTH
        await this.loadPublicParams();

        if (state.token && state.user) {
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    updateClock() {
        const el = document.getElementById('clock');
        if (el) el.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
            }
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    },

    async showLogin() {
        document.getElementById('setupWizard').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('dashboardScreen').style.display = 'none';

        try {
            if (!state.params.nom_commerce) {
                const stored = localStorage.getItem('pos_commerce_type');
                const storedName = localStorage.getItem('pos_commerce_name');
                if (storedName) state.params.nom_commerce = storedName;
                if (stored) state.params.type_commerce = stored;
            }
        } catch (e) { }

        if (state.params.nom_commerce) {
            document.getElementById('loginTitle').textContent = state.params.nom_commerce;
        }
        if (state.params.type_commerce) {
            const icons = { cafe: '☕', restaurant: '🍽️', boulangerie: '🍞', superette: '🛒' };
            document.getElementById('loginLogo').textContent = icons[state.params.type_commerce] || '🏪';
        }
        setTimeout(() => document.getElementById('loginUser').focus(), 100);
    },

    async showApp() {
        document.getElementById('setupWizard').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'none';

        try {
            const newParams = await api('/parametres');
            Object.assign(state.params, newParams);
        } catch (e) { }

        if (state.params.nom_commerce) localStorage.setItem('pos_commerce_name', state.params.nom_commerce);
        if (state.params.type_commerce) localStorage.setItem('pos_commerce_type', state.params.type_commerce);

        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = (state.user.role === 'admin' || state.user.role === 'manager') ? '' : 'none';
        });

        this.adaptUIToBusinessType();
        DASHBOARD.show();
    },

    async enterMainApp(view) {
        document.getElementById('dashboardScreen').style.display = 'none';
        const mainApp = document.getElementById('mainApp');
        mainApp.style.display = 'flex';
        mainApp.style.flexDirection = 'column';
        mainApp.style.flex = '1';
        mainApp.style.overflow = 'hidden';

        // User info header
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = `${state.user.prenom || ''} ${state.user.nom}`.trim();

        const userRoleEl = document.getElementById('userRole');
        if (userRoleEl) {
            userRoleEl.textContent = state.user.role;
            userRoleEl.className = 'badge badge-' + (state.user.role === 'admin' ? 'danger' : state.user.role === 'manager' ? 'warning' : 'info');
        }

        this.applyBusinessTheme();
        this.adaptUIToBusinessType();

        if (!this._posInitialized) {
            await POS.init();
            this._posInitialized = true;
        }
        this.checkStockAlerts();

        this.switchView(view || 'pos');
    },

    async checkRecoveryStatus() {
        try {
            const res = await fetch(`${API}/system/recovery-status`);
            const data = await res.json();
            if (data.recovery_needed) {
                const modal = document.getElementById('recoveryModal');
                if (modal) modal.style.display = 'flex';
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('dashboardScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'none';
                return true;
            }
            return false;
        } catch (e) {
            console.error("Recovery Check Error:", e);
            return false;
        }
    },

    async tryRestore() {
        const btn = document.querySelector('#recoveryModal .btn-primary');
        UI.btnLoading(btn, true, 'Restauration...');
        try {
            const res = await fetch(`${API}/system/restore-latest`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Restauration Réussie !\n\nBackup utilisé : ${data.filename}\n\nLe système va redémarrer.`);
                window.location.reload();
            } else {
                throw new Error(data.error || 'Erreur inconnue');
            }
        } catch (e) {
            alert('❌ Échec de la restauration : ' + e.message);
        } finally {
            UI.btnLoading(btn, false, 'Tentative de Récupération');
        }
    },

    async ackReset() {
        if (!confirm('⚠️ ATTENTION : TOUTES LES DONNÉES SERONT PERDUES.\n\nÊtes-vous sûr de vouloir repartir de zéro ?')) return;

        try {
            const res = await fetch(`${API}/system/ack-reset`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Système réinitialisé. Redirection vers le Setup...');
                window.location.reload();
            }
        } catch (e) { alert('Erreur: ' + e.message); }
    },

    showSupport() {
        alert('📞 CONTACT SUPPORT PRO\n\nSociété : RITAJ INFORMATIQUE\nTéléphone : +212 7 08 19 36 05\n\nDisponibilité : 9h00 - 18h00 (Lun-Ven)');
    },

    goHome() {
        document.getElementById('mainApp').style.display = 'none';
        DASHBOARD.show();
    },

    async loadPublicParams() {
        try {
            const res = await fetch(`${API}/parametres/public`);
            if (res.ok) {
                const data = await res.json();
                Object.assign(state.params, data);
            }
        } catch (e) { console.warn('Could not load public params', e); }
    },

    setupTheme() {
        localStorage.setItem('pos_theme', 'light');
        document.documentElement.removeAttribute('data-theme');
    },

    toggleTheme() {
        console.warn('Dark mode is disabled per user settings.');
        localStorage.setItem('pos_theme', 'light');
        document.documentElement.removeAttribute('data-theme');
    },

    setupVirtualNumpad() {
        if (window.NUMPAD && NUMPAD.init) NUMPAD.init();
    },

    applyBusinessTheme() {
        const root = document.documentElement;
        if (state.params.type_commerce) {
            root.setAttribute('data-business', state.params.type_commerce);
        }
        if (state.params.theme_couleur_primaire) {
            root.style.setProperty('--biz-primary', state.params.theme_couleur_primaire);
        }
        if (state.params.theme_couleur_accent) {
            root.style.setProperty('--biz-accent', state.params.theme_couleur_accent);
        }
        if (state.params.theme_header_gradient) {
            root.style.setProperty('--biz-gradient', state.params.theme_header_gradient);
        }
    },

    adaptUIToBusinessType() {
        const icons = { cafe: '☕', restaurant: '🍽️', boulangerie: '🍞', superette: '🛒' };
        const headerTitle = document.querySelector('.pos-header h1');
        if (headerTitle && state.params.nom_commerce) {
            headerTitle.textContent = `${icons[state.params.type_commerce] || '🏪'} ${state.params.nom_commerce}`;
        }
        const headerSub = document.querySelector('.header-subtitle');
        if (headerSub) {
            headerSub.textContent = `POS v4.1 — ${state.params.ville || ''}`;
        }

        const serviceTypes = ['restaurant', 'cafe', 'boulangerie', 'patisserie', 'snack', 'pizzeria', 'fast_food'];
        const isService = state.params.type_commerce && serviceTypes.includes(state.params.type_commerce) && state.params.feature_tables === '1';

        const setDisplay = (cls, show) => {
            document.querySelectorAll('.' + cls).forEach(el => el.style.display = show ? '' : 'none');
        };

        setDisplay('feature-livraison', isService && state.params.feature_livraison === '1');
        setDisplay('feature-credit', state.params.feature_credit === '1');
        setDisplay('feature-dlc', state.params.feature_dlc === '1');
        setDisplay('feature-fidelite', state.params.feature_fidelite === '1');
        setDisplay('feature-pourboire', state.params.feature_pourboire === '1');

        const orderTypeSelect = document.getElementById('orderType');
        if (orderTypeSelect) {
            let types = ['sur_place', 'emporter'];
            if (!isService) {
                types = ['standard'];
            } else {
                try { if (state.params.types_commande) types = JSON.parse(state.params.types_commande); } catch (e) { }
            }

            const labels = { sur_place: '🏠 Sur place', emporter: '🛍️ Emporter', livraison: '🚗 Livraison', drive: '🚘 Drive', standard: '🛒 Standard' };

            if (types.length === 1 && types[0] === 'standard') {
                orderTypeSelect.innerHTML = `<option value="standard">🛒 Standard</option>`;
                orderTypeSelect.style.display = 'none';
                if (typeof POS !== 'undefined' && POS.setOrderType) POS.setOrderType('standard');
            } else {
                orderTypeSelect.style.display = 'block';
                orderTypeSelect.innerHTML = types.map(t => `<option value="${t}">${labels[t] || t}</option>`).join('');
                if (typeof POS !== 'undefined' && POS.orderType && !types.includes(POS.orderType)) POS.setOrderType(types[0]);
            }
        }
    },

    async login(e) {
        e.preventDefault();
        const login = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPass').value;
        const errEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');
        errEl.style.display = 'none';

        UI.btnLoading(btn, true, 'Connexion...');

        try {
            const data = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            }).then(r => r.json());
            if (data.error) throw new Error(data.error);

            setUser(data.user);
            state.token = data.token;
            localStorage.setItem('pos_token', state.token);

            this.showApp();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
        } finally {
            UI.btnLoading(btn, false, '🔐 Connexion');
        }
        return false;
    },

    logout() {
        clearAuth();
        this.showLogin();
    },

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const viewEl = document.getElementById(`view-${view}`);
        if (viewEl) {
            viewEl.classList.add('active');
            const bodyId = view === 'pos' ? 'productsGrid' :
                view === 'livraison' ? 'livraisonBody' :
                    view + 'Body';

            if (document.getElementById(bodyId)) UI.viewLoading(bodyId, true);
        }

        const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
        if (navBtn) navBtn.classList.add('active');

        (async () => {
            try {
                if (view === 'pos') { await POS.loadProducts(); POS.renderProducts(); }
                else if (view === 'history') await HISTORY.load();
                else if (view === 'clients') await CLIENTS.load();
                else if (view === 'livraison') await LIVRAISON.load();
                else if (view === 'stock') await STOCK.load();
                else if (view === 'stats') await STATS.init();
                else if (view === 'admin') await ADMIN.init();

                // Refresh SVG icons
                setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 150);
            } catch (e) { console.error('Error loading view', e); }
        })();
    },

    async recoverDatabase() {
        if (!await UI.confirmDialog('Restaurer la sauvegarde ?', 'Cela va écraser la base de données actuelle par le dernier backup.')) return;

        const btn = document.querySelector('#recoveryModal .btn-primary');
        UI.btnLoading(btn, true, 'Restauration...');

        try {
            const res = await fetch(`${API}/system/restore-latest`, { method: 'POST' }).then(r => r.json());
            if (res.error) throw new Error(res.error);

            alert(`✅ Restauration réussie !\nBackup utilisé : ${res.filename}\n\nL'application va redémarrer.`);
            window.location.reload();
        } catch (e) {
            alert(`❌ Erreur : ${e.message}`);
            UI.btnLoading(btn, false);
        }
    },

    async resetToFactory() {
        if (!await UI.confirmDialog('Réinitialiser à Zéro ?', 'ATTENTION : Vous allez perdre toutes les données et recommencer l\'installation (Setup).', { danger: true, confirmText: 'OUI, TOUT EFFACER' })) return;

        const btn = document.querySelector('#recoveryModal .btn-outline');
        UI.btnLoading(btn, true, 'Réinitialisation...');

        try {
            const res = await fetch(`${API}/system/ack-reset`, { method: 'POST' }).then(r => r.json());
            if (res.error) throw new Error(res.error);

            window.location.reload();
        } catch (e) {
            alert(`❌ Erreur : ${e.message}`);
            UI.btnLoading(btn, false);
        }
    },

    showSupport() {
        alert('📞 RITAJ INFORMATIQUE\n\nSupport Technique : +212 7 08 19 36 05');
    },

    toggleUserMenu() {
        const dd = document.getElementById('userDropdown');
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    },

    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
        localStorage.setItem('pos_theme', isDark ? '' : 'dark');
        document.getElementById('userDropdown').style.display = 'none';
    },

    closeModal(id) { document.getElementById(id).style.display = 'none'; },

    async checkStockAlerts() {
        try {
            const alertes = await api('/stock/alertes');
            const el = document.getElementById('stockAlert');
            if (alertes.length > 0) {
                document.getElementById('stockAlertCount').textContent = alertes.length;
                el.style.display = 'flex';
            } else { el.style.display = 'none'; }
        } catch (e) { }
    },

    async openCaisseModal() {
        try {
            const status = await api('/caisse/statut');
            if (status.statut === 'ouverte') {
                POS.closeRegister();
            } else {
                POS.showOpenRegisterModal();
            }
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    async ouvrirCaisse() { POS.openRegister(); },
    async fermerCaisse() { POS.closeRegister(); },

    async manualBackup() {
        document.getElementById('userDropdown').style.display = 'none';
        try {
            await api('/backup', { method: 'POST' });
            UI.toast('💾 Backup créé avec succès !', 'success');
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    }
};

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => APP.init());

document.addEventListener('click', (e) => {
    // Close user dropdown on outside click
    if (!e.target.closest('.user-menu')) {
        const dd = document.getElementById('userDropdown');
        if (dd) dd.style.display = 'none';
    }
});

// Expose APP globally at the end
window.APP = APP;
