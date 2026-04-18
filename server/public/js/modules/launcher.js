/**
 * APP LAUNCHER (Drawer)
 * ---------------------
 * Universal navigation drawer accessible from anywhere in the app.
 * Shows all modules grouped by category, filtered/greyed by role & feature
 * flags so the user always knows what exists and why it's restricted.
 *
 * Integrates with the hash router (APP.navigate).
 */
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';

function hasRole(roles) {
    if (!state.user) return false;
    if (!roles || roles.length === 0) return true;
    return roles.includes(state.user.role);
}

function featureOn(flag) {
    if (!flag) return true;
    return state.params && state.params[flag] === '1';
}

// Full catalogue of destinations. `roles` = allowed roles (undefined => all).
// `feature` = optional feature_* flag that must be '1'.
const SECTIONS = [
    {
        title: 'Ventes',
        items: [
            { id: 'pos', icon: '🧾', label: 'Caisse', desc: 'Nouvelle vente', path: '/pos' },
            { id: 'history', icon: '📜', label: 'Commandes', desc: 'Historique & tickets', path: '/history' },
            { id: 'clients', icon: '👥', label: 'Clients', desc: 'Fidélité & crédits', path: '/clients' },
        ],
    },
    {
        title: 'Service',
        items: [
            { id: 'tables', icon: '🪑', label: 'Tables', desc: 'Plan de salle', path: '/tables', feature: 'feature_tables' },
            { id: 'livraison', icon: '🚚', label: 'Livraison', desc: 'Commandes livrées', path: '/livraison', feature: 'feature_livraison' },
            { id: 'kds', icon: '🧑‍🍳', label: 'Cuisine (KDS)', desc: 'Écran cuisine', path: '/kds', roles: ['admin', 'manager'], feature: 'feature_kds' },
        ],
    },
    {
        title: 'Gestion',
        items: [
            { id: 'stock', icon: '📦', label: 'Stock', desc: 'Inventaire & alertes', path: '/stock', roles: ['admin', 'manager'] },
            { id: 'stock-dlc', icon: '⏰', label: 'Alertes DLC', desc: 'Dates de péremption', path: '/stock/dlc', roles: ['admin', 'manager'], feature: 'feature_dlc' },
            { id: 'stats', icon: '📊', label: 'Rapports', desc: 'Statistiques & exports', path: '/stats', roles: ['admin', 'manager'] },
            { id: 'produits', icon: '🛍️', label: 'Produits', desc: 'Catalogue', path: '/admin/produits', roles: ['admin', 'manager'] },
            { id: 'categories', icon: '📂', label: 'Catégories', desc: 'Rayons & familles', path: '/admin/categories', roles: ['admin', 'manager'] },
        ],
    },
    {
        title: 'Administration',
        items: [
            { id: 'admin', icon: '⚙️', label: 'Paramètres', desc: 'Configuration', path: '/admin/parametres', roles: ['admin', 'manager'] },
            { id: 'users', icon: '👤', label: 'Utilisateurs', desc: 'Comptes & rôles', path: '/admin/utilisateurs', roles: ['admin'] },
            { id: 'backups', icon: '💾', label: 'Sauvegardes', desc: 'Backup / restore', path: '/admin/backups', roles: ['admin'] },
            { id: 'imprimantes', icon: '🖨️', label: 'Imprimantes', desc: 'Tickets & étiquettes', path: '/admin/imprimantes', roles: ['admin', 'manager'] },
            { id: 'caisse', icon: '💰', label: 'Gestion Caisse', desc: 'Ouverture / Fermeture', action: 'caisse' },
        ],
    },
    {
        title: 'Accueil',
        items: [
            { id: 'dashboard', icon: '🏠', label: 'Tableau de bord', desc: 'Accueil', path: '/dashboard' },
        ],
    },
];

export const LAUNCHER = {
    _open: false,

    toggle() {
        if (this._open) this.close(); else this.open();
    },

    open() {
        let drawer = document.getElementById('appLauncher');
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = 'appLauncher';
            drawer.className = 'app-launcher';
            drawer.setAttribute('role', 'dialog');
            drawer.setAttribute('aria-label', 'Modules');
            document.body.appendChild(drawer);
            drawer.addEventListener('click', (e) => {
                if (e.target === drawer) this.close();
            });
        }
        drawer.innerHTML = this._render();
        drawer.classList.add('open');
        this._open = true;
        // Wire up clicks
        drawer.querySelectorAll('[data-launch]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.getAttribute('data-launch');
                const item = this._findItem(id);
                this._activate(item, btn);
            });
        });
        const closeBtn = drawer.querySelector('.launcher-close');
        if (closeBtn) closeBtn.onclick = () => this.close();
        // Focus trap basics
        const firstItem = drawer.querySelector('[data-launch]');
        if (firstItem) setTimeout(() => firstItem.focus(), 30);
        // Escape key
        this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._escHandler);
    },

    close() {
        const drawer = document.getElementById('appLauncher');
        if (drawer) drawer.classList.remove('open');
        this._open = false;
        if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    },

    _findItem(id) {
        for (const section of SECTIONS) {
            const hit = section.items.find(i => i.id === id);
            if (hit) return hit;
        }
        return null;
    },

    _activate(item, btn) {
        if (!item) return;
        const locked = btn && btn.classList.contains('locked');
        const disabled = btn && btn.classList.contains('disabled');
        if (locked) {
            UI.toast('🔒 Accès restreint à votre rôle', 'error');
            return;
        }
        if (disabled) {
            UI.toast('Fonctionnalité désactivée dans les paramètres', 'info');
            return;
        }
        this.close();
        if (item.action === 'caisse') {
            if (window.APP && APP.openCaisseModal) APP.openCaisseModal();
            return;
        }
        if (item.path && window.APP && APP.navigate) {
            APP.navigate(item.path);
        }
    },

    _render() {
        const body = SECTIONS.map(section => {
            const items = section.items.map(item => {
                const allowed = hasRole(item.roles);
                const active = featureOn(item.feature);
                const isCurrent = item.path && (location.hash === '#' + item.path || (item.path === '/dashboard' && !location.hash));
                const classes = ['launcher-item'];
                if (!allowed) classes.push('locked');
                else if (!active) classes.push('disabled');
                if (isCurrent) classes.push('current');
                const badge = !allowed ? '<span class="launcher-lock" aria-label="Accès restreint">🔒</span>'
                    : !active ? '<span class="launcher-lock" aria-label="Désactivé" title="Désactivé dans les paramètres">—</span>'
                        : '';
                return `
          <button type="button" class="${classes.join(' ')}" data-launch="${item.id}"
                  aria-label="${item.label}${!allowed ? ' (accès restreint)' : ''}">
            <span class="launcher-icon">${item.icon}</span>
            <span class="launcher-text">
              <span class="launcher-label">${item.label}</span>
              <span class="launcher-desc">${item.desc || ''}</span>
            </span>
            ${badge}
          </button>`;
            }).join('');
            return `
        <section class="launcher-section">
          <h3 class="launcher-section-title">${section.title}</h3>
          <div class="launcher-grid">${items}</div>
        </section>`;
        }).join('');
        const userLabel = state.user ? `${state.user.prenom || ''} ${state.user.nom || ''}`.trim() : '';
        const roleBadge = state.user ? `<span class="launcher-role badge badge-${state.user.role === 'admin' ? 'danger' : state.user.role === 'manager' ? 'warning' : 'info'}">${state.user.role}</span>` : '';
        return `
      <div class="launcher-panel">
        <header class="launcher-header">
          <div>
            <h2>Modules</h2>
            <p class="launcher-sub">${userLabel} ${roleBadge}</p>
          </div>
          <button class="launcher-close btn btn-ghost" aria-label="Fermer">✕</button>
        </header>
        <div class="launcher-body">${body}</div>
        <footer class="launcher-foot">
          <small>Astuce : appuyez sur <kbd>Échap</kbd> pour fermer.</small>
        </footer>
      </div>`;
    },
};

window.LAUNCHER = LAUNCHER;
