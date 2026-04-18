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
import { KDS } from '../modules/kds.js';
import { TABLES } from '../modules/tables.js';
import { LAUNCHER } from '../modules/launcher.js';

// Expose modules to global scope for HTML event handlers
window.POS = POS;
window.LAUNCHER = LAUNCHER;
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
window.KDS = KDS;
window.TABLES = TABLES;

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
    currentPath: '/dashboard',

    /* ════════ ROUTER (hash-based) ════════ */
    _routeTitles: {
        '/dashboard': 'Accueil',
        '/pos': 'Caisse',
        '/history': 'Commandes',
        '/clients': 'Clients',
        '/stock': 'Stock',
        '/stock/dlc': 'Alertes DLC',
        '/stats': 'Rapports',
        '/admin': 'Administration',
        '/livraison': 'Livraison',
        '/tables': 'Tables',
        '/kds': 'Cuisine',
    },

    // view requirements: role allowed list (undefined => any authenticated user)
    _viewRoles: {
        stock: ['admin', 'manager'],
        stats: ['admin', 'manager'],
        admin: ['admin', 'manager'],
        kds: ['admin', 'manager'],
    },

    _parsePath(hash) {
        const raw = (hash || '').replace(/^#/, '').trim();
        if (!raw || raw === '/') return { view: 'dashboard', segments: [] };
        const segs = raw.split('/').filter(Boolean);
        return { view: segs[0], segments: segs.slice(1) };
    },

    _canAccess(view) {
        const roles = this._viewRoles[view];
        if (!roles) return true;
        if (!state.user) return false;
        return roles.includes(state.user.role);
    },

    _updateDocTitle(path) {
        const base = (state.params && state.params.nom_commerce) || 'RITAJ SMART POS';
        const t = this._routeTitles[path] || this._routeTitles['/' + (path || '').split('/')[1]] || '';
        document.title = t ? `${t} — ${base}` : base;
    },

    _persistLastPath(path) {
        try {
            const u = state.user ? (state.user.login || state.user.id || 'u') : 'guest';
            localStorage.setItem('pos_last_path:' + u, path);
        } catch (e) { /* ignore */ }
    },

    _loadLastPath() {
        try {
            if (!state.user) return null;
            const u = state.user.login || state.user.id || 'u';
            return localStorage.getItem('pos_last_path:' + u);
        } catch (e) { return null; }
    },

    /**
     * Programmatic navigation. Updates location.hash which triggers the
     * hashchange listener and applies the route. Use this in preference to
     * switchView / enterMainApp directly.
     *
     *   APP.navigate('/pos')
     *   APP.navigate('/admin/produits')
     *   APP.navigate('/stats/credits')
     *   APP.navigate('/stock/dlc')
     *   APP.navigate('/dashboard')
     */
    navigate(path, { replace = false } = {}) {
        if (!path) path = '/dashboard';
        if (!path.startsWith('/')) path = '/' + path;
        const target = '#' + path;
        if (location.hash === target) {
            // Still re-apply (e.g. tab change within the same view)
            this._applyRoute(path);
            return;
        }
        if (replace) {
            history.replaceState(null, '', location.pathname + location.search + target);
            this._applyRoute(path);
        } else {
            location.hash = path; // triggers hashchange → _applyRoute
        }
    },

    _installRouter() {
        if (this._routerInstalled) return;
        this._routerInstalled = true;
        window.addEventListener('hashchange', () => {
            const { view } = this._parsePath(location.hash);
            // Recovery / setup / login screens bypass the router entirely
            if (!state.user) return;
            const path = location.hash.slice(1) || '/dashboard';
            this._applyRoute(path);
        });
    },

    _applyRoute(path) {
        const { view, segments } = this._parsePath('#' + path);
        this.currentPath = path;
        this._updateDocTitle(path);
        this._persistLastPath(path);

        // Dashboard → show dashboard screen
        if (view === 'dashboard' || !view) {
            document.getElementById('mainApp').style.display = 'none';
            DASHBOARD.show();
            return;
        }

        // Role guard
        if (!this._canAccess(view)) {
            UI.toast('🔒 Accès restreint à votre rôle', 'error');
            this.navigate('/dashboard', { replace: true });
            return;
        }

        // Make sure mainApp is visible, then switch to target view.
        this.enterMainApp(view, { skipNavigate: true }).then(() => {
            // Apply sub-route (admin tab, stats report, stock sub-view) AFTER
            // the view's async init resolves, so no more setTimeout races.
            if (view === 'admin' && segments[0] && window.ADMIN) {
                try { ADMIN.switchTab(segments[0]); } catch (e) { /* ignore */ }
            } else if (view === 'stats' && segments[0] && window.STATS) {
                try { STATS.switchReport(segments[0]); } catch (e) { /* ignore */ }
            } else if (view === 'stock' && segments[0] === 'dlc' && window.STOCK && STOCK.showAlertesDLC) {
                try { STOCK.showAlertesDLC(); } catch (e) { /* ignore */ }
            }
        }).catch(() => { /* ignore */ });
    },

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
        this._setupModalKeyboardFix();
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

        // Install router once user is authenticated
        this._installRouter();

        // If a hash route exists (deep-link or refresh) honour it; otherwise
        // restore last visited path; fallback to dashboard.
        const hashPath = location.hash ? location.hash.slice(1) : '';
        const lastPath = this._loadLastPath();
        const target = hashPath || lastPath || '/dashboard';
        // Replace so we don't stack a spurious history entry
        this.navigate(target, { replace: true });
    },

    async enterMainApp(view, opts = {}) {
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

        // When called from the router we already know the view; otherwise
        // update the hash so external calls (legacy) stay in sync.
        if (opts.skipNavigate) {
            await this._doSwitchView(view || 'pos');
        } else {
            this.navigate('/' + (view || 'pos'));
        }
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
        this.navigate('/dashboard');
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

    // On touch devices the virtual keyboard often hides the focused input
    // (especially in modals). This global listener scrolls the field into
    // the visible portion of its scroll container when focus lands on it.
    _setupModalKeyboardFix() {
        if (this._kbdFixInstalled) return;
        this._kbdFixInstalled = true;
        document.addEventListener('focusin', (e) => {
            const el = e.target;
            if (!el || !(el.matches && el.matches('input, textarea, select'))) return;
            // Only inside modals / overlays where clipping matters
            const modal = el.closest('.modal, .modal-overlay, .confirm-box, .app-launcher');
            if (!modal) return;
            setTimeout(() => {
                try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) { /* older browsers */ }
            }, 150);
        });
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

        const serviceTypes = ['restaurant', 'restaurant_service', 'cafe', 'cafe_classique', 'salon_the', 'fast_food', 'snack', 'pizzeria'];
        const isService = state.params.type_commerce && serviceTypes.includes(state.params.type_commerce) && state.params.feature_tables === '1';

        const setDisplay = (cls, show) => {
            document.querySelectorAll('.' + cls).forEach(el => el.style.display = show ? '' : 'none');
        };

        setDisplay('feature-livraison', isService && state.params.feature_livraison === '1');
        setDisplay('feature-credit', state.params.feature_credit === '1');
        setDisplay('feature-dlc', state.params.feature_dlc === '1');
        setDisplay('feature-fidelite', state.params.feature_fidelite === '1');
        setDisplay('feature-pourboire', state.params.feature_pourboire === '1');
        setDisplay('feature-tables', state.params.feature_tables === '1');
        setDisplay('feature-kds', state.params.feature_kds === '1');

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
        // Public API: sync with router. The hashchange handler will call
        // _doSwitchView via _applyRoute. If we're already on the view, run
        // the switch synchronously (idempotent).
        if (location.hash === '#/' + view) {
            return this._doSwitchView(view);
        }
        this.navigate('/' + view);
    },

    async _doSwitchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        // Stop KDS auto-refresh when leaving the KDS view
        if (view !== 'kds' && KDS._refreshTimer) KDS.destroy();

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

        try {
            if (view === 'pos') { await POS.loadProducts(); POS.renderProducts(); }
            else if (view === 'history') await HISTORY.load();
            else if (view === 'clients') await CLIENTS.load();
            else if (view === 'livraison') await LIVRAISON.load();
            else if (view === 'stock') await STOCK.load();
            else if (view === 'stats') await STATS.init();
            else if (view === 'admin') await ADMIN.init();
            else if (view === 'kds') await KDS.load();
            else if (view === 'tables') await TABLES.load();
        } catch (e) { console.error('Error loading view', e); }

        // Refresh SVG icons immediately (requestAnimationFrame) rather than
        // setTimeout(150) which causes a visible flash on tactile hardware.
        if (window.lucide) {
            requestAnimationFrame(() => { try { window.lucide.createIcons(); } catch (e) { } });
        }
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
