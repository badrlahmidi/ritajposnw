/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Application v4.1 (2026)
 *  Setup Wizard + Auth JWT + TVA + Stock + Clients + Fidélité
 * ═══════════════════════════════════════════════════════════════
 */

// Base path dynamique — détecté depuis l'URL courante
const API = window.location.pathname.replace(/\/+$/, '') + '/api';
let TOKEN = localStorage.getItem('pos_token') || '';
let USER = JSON.parse(localStorage.getItem('pos_user') || 'null');
let PARAMS = {};
let SETUP_PROFILES = [];

// ═══════════════ OFFLINE QUEUE ═══════════════
const OFFLINE_QUEUE = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');

async function api(endpoint, options = {}) {
  const opts = {
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}) },
    ...options
  };
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }

  // Check connectivity for mutations
  const isMutation = ['POST', 'PUT', 'DELETE'].includes(opts.method || 'GET');
  if (!navigator.onLine) {
    if (isMutation) {
      queueRequest(endpoint, options);
      return { offline: true };
    } else {
      // GET offline: try cache
      const cached = localStorage.getItem('pos_cache_' + endpoint);
      if (cached) {
        toast('📡 Mode Hors-ligne: Données locales utilisées', 'info');
        return JSON.parse(cached);
      }
      throw new Error('Hors-ligne : Données non disponibles');
    }
  }

  try {
    const res = await fetch(`${API}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) { APP.logout(); throw new Error('Session expirée'); }
      if (data.details && Array.isArray(data.details)) {
        console.error('Validation Errors:', data.details);
        const detailedMsg = data.details.map(d => `${d.champ}: ${d.message}`).join(' | ');
        throw new Error('Données invalides : ' + detailedMsg);
      }
      throw new Error(data.error || 'Erreur serveur');
    }

    // Cache successful GET requests for critical data
    if (!isMutation && (endpoint.includes('/produits') || endpoint.includes('/categories') || endpoint.includes('/parametres') || endpoint.includes('/clients') || endpoint.includes('/taxes'))) {
      try {
        localStorage.setItem('pos_cache_' + endpoint, JSON.stringify(data));
      } catch (e) { console.warn('Cache full', e); }
    }

    return data;
  } catch (err) {
    // If network error
    if (err.message.match(/Failed to fetch|NetworkError/i)) {
      if (isMutation) {
        queueRequest(endpoint, options);
        return { offline: true };
      } else {
        // Try cache as fallback even if we thought we were online
        const cached = localStorage.getItem('pos_cache_' + endpoint);
        if (cached) {
          toast('📡 Erreur réseau: Données locales utilisées', 'warning');
          return JSON.parse(cached);
        }
      }
    }
    throw err;
  }
}

function queueRequest(endpoint, options) {
  OFFLINE_QUEUE.push({ endpoint, options, timestamp: Date.now() });
  localStorage.setItem('pos_offline_queue', JSON.stringify(OFFLINE_QUEUE));
  toast('📡 Mode Hors-ligne: Requête sauvegardée', 'warning');
}

// Sync periodic
setInterval(async () => {
  if (!OFFLINE_QUEUE.length || !navigator.onLine) return;
  const item = OFFLINE_QUEUE.shift();
  try {
    // Use raw fetch to avoid re-queueing loop logic
    const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}) };
    const res = await fetch(`${API}${item.endpoint}`, { ...item.options, headers });
    if (res.ok) {
      localStorage.setItem('pos_offline_queue', JSON.stringify(OFFLINE_QUEUE));
      toast('✅ Synchro réussie', 'success');
    } else {
      // If server error (not network), log it and maybe discard or move to dead letter queue?
      // For now, put back and wait.
      OFFLINE_QUEUE.unshift(item);
    }
  } catch (e) {
    OFFLINE_QUEUE.unshift(item); // Network fail again
  }
}, 30000); // 30 seconds

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeftColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)';
  el.style.borderLeftWidth = '4px';
  el.style.borderLeftStyle = 'solid';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ═══════════════════ UI UTILITIES ═══════════════════

/** Confirmation dialog (remplace window.confirm) */
function confirmDialog(title, message, { icon = '⚠️', confirmText = 'Confirmer', cancelText = 'Annuler', danger = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon">${icon}</div>
        <div class="confirm-title">${title}</div>
        <div class="confirm-message">${message}</div>
        <div class="confirm-actions">
          <button class="btn btn-outline" id="confirmCancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmOk').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#confirmCancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    overlay.querySelector('#confirmOk').focus();
  });
}

/** Loading state pour un bouton */
function btnLoading(btn, loading = true, text = '') {
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${text || 'Chargement...'}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origText || text || btn.innerHTML;
  }
}

/** Loading state pour une vue/conteneur */
function viewLoading(containerId, loading = true) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (loading) {
    el.innerHTML = `<div class="view-loading"><span class="spinner spinner-lg"></span> Chargement...</div>`;
  }
}

/** Wrapper table responsive — enveloppe les tables dans un conteneur scrollable */
function wrapTablesResponsive(html) {
  return html.replace(/<table class="data-table"/g, '<div class="table-responsive"><table class="data-table"')
    .replace(/<\/table>/g, '</table></div>');
}

/** Validation inline pour un champ */
function validateField(input, rules = {}) {
  const group = input.closest('.form-group');
  if (!group) return true;
  const val = input.value.trim();
  let error = '';

  if (rules.required && !val) error = rules.requiredMsg || 'Ce champ est requis';
  else if (rules.minLength && val.length < rules.minLength) error = `Minimum ${rules.minLength} caractères`;
  else if (rules.maxLength && val.length > rules.maxLength) error = `Maximum ${rules.maxLength} caractères`;
  else if (rules.min !== undefined && Number(val) < rules.min) error = `Minimum ${rules.min}`;
  else if (rules.pattern && !rules.pattern.test(val)) error = rules.patternMsg || 'Format invalide';
  else if (rules.email && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) error = 'Email invalide';

  const existing = group.querySelector('.form-error');
  if (existing) existing.remove();

  if (error) {
    group.classList.add('has-error');
    group.classList.remove('has-success');
    const errEl = document.createElement('span');
    errEl.className = 'form-error';
    errEl.textContent = error;
    group.appendChild(errEl);
    return false;
  } else {
    group.classList.remove('has-error');
    if (val) group.classList.add('has-success');
    return true;
  }
}

/** Modal raccourcis clavier */
function showShortcutsModal() {
  let modal = document.getElementById('shortcutsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'shortcutsModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-header">
          <h2>⌨️ Raccourcis Clavier</h2>
          <button class="btn btn-icon modal-close" onclick="APP.closeModal('shortcutsModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="shortcuts-grid">
            <div class="shortcut-item"><span>Recherche produit</span><kbd class="kbd">F2</kbd></div>
            <div class="shortcut-item"><span>Nouvelle commande</span><kbd class="kbd">F4</kbd></div>
            <div class="shortcut-item"><span>Rafraîchir</span><kbd class="kbd">F5</kbd></div>
            <div class="shortcut-item"><span>Gérer caisse</span><kbd class="kbd">F8</kbd></div>
            <div class="shortcut-item"><span>Plein écran</span><kbd class="kbd">F11</kbd></div>
            <div class="shortcut-item"><span>Fermer</span><kbd class="kbd">Échap</kbd></div>
          </div>
          <div class="mt-16 text-center text-muted" style="font-size:0.75rem">
            Astuce : Utilisez "Tab" pour naviguer entre les champs.
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
}

// Global Keyboard Listeners
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') { e.preventDefault(); showShortcutsModal(); }
  if (e.key === 'F2') { e.preventDefault(); document.getElementById('searchInput')?.focus(); }
  if (e.key === 'F4') { e.preventDefault(); POS.clearCart(); }
  if (e.key === 'F8') { e.preventDefault(); APP.openCaisseModal(); }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    document.getElementById('userDropdown').style.display = 'none';
  }
});


// ═══════════════════ VIRTUAL NUMPAD ═══════════════════
const NUMPAD = {
  activeInput: null,
  value: '',
  callback: null,

  init() {
    const el = document.createElement('div');
    el.innerHTML = `
    <div id="numpadOverlay" class="numpad-overlay" onclick="if(event.target===this) NUMPAD.close()">
      <div class="numpad-container">
        <div id="numpadDisplay" class="numpad-display">0</div>
        <div class="numpad-grid">
          <button class="numpad-btn" onclick="NUMPAD.tap('7')">7</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('8')">8</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('9')">9</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('4')">4</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('5')">5</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('6')">6</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('1')">1</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('2')">2</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('3')">3</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('.')">.</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('0')">0</button>
          <button class="numpad-btn danger" onclick="NUMPAD.clear()">⌫</button>
          <button class="numpad-btn primary" style="grid-column:1/-1;margin-top:10px" onclick="NUMPAD.confirm()">OK ↵</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(el);
  },

  open(inputElement, onConfirm = null) {
    this.activeInput = inputElement;
    this.value = '';
    this.callback = onConfirm;
    document.getElementById('numpadDisplay').textContent = inputElement.value || '0';
    document.getElementById('numpadOverlay').style.display = 'flex';
  },

  tap(char) {
    if (char === '.' && this.value.includes('.')) return;
    this.value += char;
    document.getElementById('numpadDisplay').textContent = this.value;
  },
  clear() {
    this.value = this.value.slice(0, -1);
    document.getElementById('numpadDisplay').textContent = this.value || '0';
  },

  confirm() {
    if (this.activeInput) {
      this.activeInput.value = this.value;
      this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      this.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      if (this.callback) this.callback(this.value);
    }
    this.close();
  },

  close() {
    document.getElementById('numpadOverlay').style.display = 'none';
    this.activeInput = null;
  }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => NUMPAD.init(), 1000); });

// Attach Numpad to inputs on touch devices
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.classList.contains('use-numpad'))) {
    // Check if touch device
    if (window.matchMedia('(pointer: coarse)').matches || e.target.classList.contains('force-numpad')) {
      // Prevent default keyboard if possible/desired
      e.preventDefault();
      e.target.blur();
      NUMPAD.open(e.target);
    }
  }
});

// ╔═══════════════════════════════════════════════════════════╗
// ║                        APP                                ║
// ╚═══════════════════════════════════════════════════════════╝

const APP = {
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
    // Thème et Horloge
    if (localStorage.getItem('pos_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    this.updateClock();
    setInterval(() => this.updateClock(), 30000);

    // 0. CHECK RECOVERY (Critical)
    try {
      if (await this.checkRecoveryStatus()) return;
    } catch (e) { console.error('Recovery check failed', e); }

    this.setupTheme();
    this.setupVirtualNumpad();

    // 1. SETUP STATUS
    try {
      const setupStatus = await fetch(`${API}/setup/status`).then(r => r.json());
      if (!setupStatus.completed) return SETUP.start();
    } catch (e) { console.warn('Erreur vérification setup:', e); }

    // 2. PARAMS & AUTH
    await this.loadPublicParams();

    if (TOKEN && USER) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  updateClock() {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  },

  async showLogin() {
    document.getElementById('setupWizard').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'none';

    // Charger les paramètres pour personnaliser le login (ne nécessite pas d'auth si minimal)
    // On utilise les PARAMS déjà chargés, ou on tente un fetch minimal
    try {
      if (!PARAMS.nom_commerce) {
        // Les paramètres publics ne sont pas disponibles sans auth,
        // mais on peut stocker le type de commerce en localStorage
        const stored = localStorage.getItem('pos_commerce_type');
        const storedName = localStorage.getItem('pos_commerce_name');
        if (storedName) PARAMS.nom_commerce = storedName;
        if (stored) PARAMS.type_commerce = stored;
      }
    } catch (e) { }

    // Personnaliser la page de login selon le profil
    if (PARAMS.nom_commerce) {
      document.getElementById('loginTitle').textContent = PARAMS.nom_commerce;
    }
    if (PARAMS.type_commerce) {
      const icons = { cafe: '☕', restaurant: '🍽️', boulangerie: '🍞', superette: '🛒' };
      document.getElementById('loginLogo').textContent = icons[PARAMS.type_commerce] || '🏪';
    }
    setTimeout(() => document.getElementById('loginUser').focus(), 100);
  },

  async showApp() {
    // viewLoading('mainApp', true); // DESTRUCTIVE! Removed.
    document.getElementById('setupWizard').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';

    // Load params
    try { PARAMS = await api('/parametres'); } catch (e) { }

    // Stocker infos commerce en localStorage pour l'écran de login
    if (PARAMS.nom_commerce) localStorage.setItem('pos_commerce_name', PARAMS.nom_commerce);
    if (PARAMS.type_commerce) localStorage.setItem('pos_commerce_type', PARAMS.type_commerce);

    // Hide admin elements for non-admin (dashboard + mainApp)
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = (USER.role === 'admin' || USER.role === 'manager') ? '' : 'none';
    });

    // Afficher les boutons de feature selon le profil métier
    // Force UI adaptation based on business profile & features
    this.adaptUIToBusinessType();

    // viewLoading('mainApp', false);
    // Afficher le Dashboard d'accueil
    DASHBOARD.show();
  },

  /** Passe du dashboard au mainApp avec la vue spécifiée */
  async enterMainApp(view) {
    document.getElementById('dashboardScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    mainApp.style.flexDirection = 'column';
    mainApp.style.flex = '1';
    mainApp.style.overflow = 'hidden';

    // User info header
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = `${USER.prenom || ''} ${USER.nom}`.trim();

    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) {
      userRoleEl.textContent = USER.role;
      userRoleEl.className = 'badge badge-' + (USER.role === 'admin' ? 'danger' : USER.role === 'manager' ? 'warning' : 'info');
    }

    // Appliquer le thème du profil métier
    this.applyBusinessTheme();
    this.adaptUIToBusinessType();

    // Init POS si pas encore fait
    if (!this._posInitialized) {
      // viewLoading('view-pos', true); // CAUSES DOM DESTRUCTION
      await POS.init();
      this._posInitialized = true;
      // viewLoading('view-pos', false);
    }
    this.checkStockAlerts();

    // Basculer vers la vue demandée
    this.switchView(view || 'pos');
  },

  // --- RECOVERY MODE LOGIC ---
  async checkRecoveryStatus() {
    try {
      const res = await fetch(`${API}/system/recovery-status`);
      const data = await res.json();
      if (data.recovery_needed) {
        // Show Recovery Modal
        const modal = document.getElementById('recoveryModal');
        if (modal) modal.style.display = 'flex';
        // Hide other screens
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboardScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'none';
        return true; // Recovery mode active
      }
      return false;
    } catch (e) {
      console.error("Recovery Check Error:", e);
      return false; // Assume normal or offline
    }
  },

  async tryRestore() {
    const btn = document.querySelector('#recoveryModal .btn-primary');
    btnLoading(btn, true, 'Restauration...');
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
      btnLoading(btn, false, 'Tentative de Récupération');
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

  /** Retour au Dashboard depuis le mainApp */
  goHome() {
    document.getElementById('mainApp').style.display = 'none';
    DASHBOARD.show();
  },

  async loadPublicParams() {
    try {
      const res = await fetch(`${API}/parametres/public`);
      if (res.ok) {
        const data = await res.json();
        Object.assign(PARAMS, data);
      }
    } catch (e) { console.warn('Could not load public params', e); }
  },

  // --- THEMES & UI ---

  setupTheme() {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('pos_theme');
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  },

  toggleTheme() {
    const root = document.documentElement;
    if (root.getAttribute('data-theme') === 'dark') {
      root.removeAttribute('data-theme');
      localStorage.setItem('pos_theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('pos_theme', 'dark');
    }
  },

  setupVirtualNumpad() {
    // Already handled by NUMPAD object on DOMContentLoaded but we can re-init if needed
    if (window.NUMPAD && NUMPAD.init) NUMPAD.init();
  },

  applyBusinessTheme() {
    const root = document.documentElement;
    if (PARAMS.type_commerce) {
      root.setAttribute('data-business', PARAMS.type_commerce);
    }
    if (PARAMS.theme_couleur_primaire) {
      root.style.setProperty('--biz-primary', PARAMS.theme_couleur_primaire);
    }
    if (PARAMS.theme_couleur_accent) {
      root.style.setProperty('--biz-accent', PARAMS.theme_couleur_accent);
    }
    if (PARAMS.theme_header_gradient) {
      root.style.setProperty('--biz-gradient', PARAMS.theme_header_gradient);
    }
  },

  adaptUIToBusinessType() {
    const icons = { cafe: '☕', restaurant: '🍽️', boulangerie: '🍞', superette: '🛒' };
    const headerTitle = document.querySelector('.pos-header h1');
    if (headerTitle && PARAMS.nom_commerce) {
      headerTitle.textContent = `${icons[PARAMS.type_commerce] || '🏪'} ${PARAMS.nom_commerce}`;
    }
    const headerSub = document.querySelector('.header-subtitle');
    if (headerSub) {
      headerSub.textContent = `POS v4.1 — ${PARAMS.ville || ''}`;
    }

    // Determine Service Mode (Restaurant, Cafe, etc.)
    const serviceTypes = ['restaurant', 'cafe', 'boulangerie', 'patisserie', 'snack', 'pizzeria', 'fast_food'];
    // Strict Retail Pivot: Only consider it a "Service" business if Tables are explicitly enabled
    const isService = PARAMS.type_commerce && serviceTypes.includes(PARAMS.type_commerce) && PARAMS.feature_tables === '1';

    // Helper to toggle visibility for features
    const setDisplay = (cls, show) => {
      document.querySelectorAll('.' + cls).forEach(el => el.style.display = show ? '' : 'none');
    };

    // 1. Service-Specific Features (Tables, KDS, Livraison)
    // Must be a service business AND have the feature enabled
    setDisplay('feature-livraison', isService && PARAMS.feature_livraison === '1');

    // 2. General Features (Available for all types if enabled)
    setDisplay('feature-credit', PARAMS.feature_credit === '1');
    setDisplay('feature-dlc', PARAMS.feature_dlc === '1');
    setDisplay('feature-fidelite', PARAMS.feature_fidelite === '1');
    setDisplay('feature-pourboire', PARAMS.feature_pourboire === '1');

    // 3. Order Types Logic (Dropdown)
    const orderTypeSelect = document.getElementById('orderType');
    if (orderTypeSelect) {
      let types = ['sur_place', 'emporter'];

      // If NOT a service business (Retail), force Standard mode
      if (!isService) {
        types = ['standard'];
      } else {
        try { if (PARAMS.types_commande) types = JSON.parse(PARAMS.types_commande); } catch (e) { }
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

    btnLoading(btn, true, 'Connexion...');

    try {
      const data = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      TOKEN = data.token;
      USER = data.user;
      localStorage.setItem('pos_token', TOKEN);
      localStorage.setItem('pos_user', JSON.stringify(USER));
      this.showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btnLoading(btn, false, '🔐 Connexion');
    }
    return false;
  },

  logout() {
    TOKEN = ''; USER = null;
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    this.showLogin();
  },



  switchView(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // View element
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) {
      viewEl.classList.add('active');
      // Add loading state to view body
      const bodyId = view === 'pos' ? 'productsGrid' :
        view === 'livraison' ? 'livraisonBody' :
          view + 'Body';

      if (document.getElementById(bodyId)) viewLoading(bodyId, true);
    }

    const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Load view data
    (async () => {
      try {
        if (view === 'pos') { await POS.loadProducts(); POS.renderProducts(); }
        else if (view === 'history') await HISTORY.load();
        else if (view === 'clients') await CLIENTS.load();
        else if (view === 'livraison') await LIVRAISON.load();
        else if (view === 'stock') await STOCK.load();
        else if (view === 'stats') await STATS.init();
        else if (view === 'admin') await ADMIN.init();
      } catch (e) { console.error('Error loading view', e); }
    })();
  },

  async recoverDatabase() {
    if (!await confirmDialog('Restaurer la sauvegarde ?', 'Cela va écraser la base de données actuelle par le dernier backup.')) return;

    // Show spinner in modal
    const btn = document.querySelector('#recoveryModal .btn-primary');
    btnLoading(btn, true, 'Restauration...');

    try {
      const res = await fetch(`${API}/system/restore-latest`, { method: 'POST' }).then(r => r.json());
      if (res.error) throw new Error(res.error);

      alert(`✅ Restauration réussie !\nBackup utilisé : ${res.filename}\n\nL'application va redémarrer.`);
      window.location.reload();
    } catch (e) {
      alert(`❌ Erreur : ${e.message}`);
      btnLoading(btn, false);
    }
  },

  async resetToFactory() {
    if (!await confirmDialog('Réinitialiser à Zéro ?', 'ATTENTION : Vous allez perdre toutes les données et recommencer l\'installation (Setup).', { danger: true, confirmText: 'OUI, TOUT EFFACER' })) return;

    const btn = document.querySelector('#recoveryModal .btn-outline');
    btnLoading(btn, true, 'Réinitialisation...');

    try {
      const res = await fetch(`${API}/system/ack-reset`, { method: 'POST' }).then(r => r.json());
      if (res.error) throw new Error(res.error);

      window.location.reload(); // Should go to Setup Wizard
    } catch (e) {
      alert(`❌ Erreur : ${e.message}`);
      btnLoading(btn, false);
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
        POS.closeRegister(); // Will show status modal with close option
      } else {
        POS.showOpenRegisterModal();
      }
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  // Legacy wrappers removed or redirected
  async ouvrirCaisse() { POS.openRegister(); },
  async fermerCaisse() { POS.closeRegisterConfirm(); },




  async manualBackup() {
    document.getElementById('userDropdown').style.display = 'none';
    try {
      await api('/backup', { method: 'POST' });
      toast('💾 Backup créé avec succès !', 'success');
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  }
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                        POS                                ║
// ╚═══════════════════════════════════════════════════════════╝

const POS = {
  categories: [], produits: [], cart: [],
  currentCategory: 'all', currentPaymentMode: '', currentTarif: 'particulier',
  selectedClient: null, discount: null, orderType: 'emporter',
  lastOrder: null, deliveryInfo: null, numpadBuffer: '',

  setOrderType(type) {
    this.orderType = type;

    // Retail Mode: No Table Selection
    // Just handle UI for Delivery
    if (type === 'livraison' || type === 'emporter') {
      const isLivraison = type === 'livraison';
      document.getElementById('deliveryModalTitle').textContent = isLivraison ? '🚗 Infos Livraison' : '🛍️ Infos A Emporter';
      document.getElementById('deliveryAddressGroup').style.display = isLivraison ? 'block' : 'none';
      document.getElementById('deliveryFeeGroup').style.display = isLivraison ? 'block' : 'none';

      // Pre-fill if client selected
      if (this.selectedClient) {
        document.getElementById('deliveryClientName').value = this.selectedClient.nom;
        document.getElementById('deliveryPhone').value = this.selectedClient.telephone || '';
        document.getElementById('deliveryAddress').value = this.selectedClient.adresse || '';
      } else {
        document.getElementById('deliveryClientName').value = '';
        document.getElementById('deliveryPhone').value = '';
        document.getElementById('deliveryAddress').value = '';
        document.getElementById('deliveryFee').value = '0';
      }
      document.getElementById('deliveryModal').style.display = 'flex';
    } else {
      this.deliveryInfo = null;
    }
  },

  numpadAction(val) {
    if (val === 'C') {
      this.numpadBuffer = '';
      toast('Numpad effacé', 'info');
      return;
    }
    if (val === 'QTY') {
      if (!this.numpadBuffer) return;
      const qty = parseFloat(this.numpadBuffer);
      this.numpadBuffer = ''; // clear immediately

      if (isNaN(qty) || qty <= 0) {
        toast('Quantité invalide', 'warning');
        return;
      }

      if (this.cart.length > 0) {
        // Updates the last item added
        const idx = this.cart.length - 1;
        this.updateQuantity(idx, qty);
        toast(`Quantité : ${qty}`, 'success');
      } else {
        toast('Panier vide', 'warning');
      }
      return;
    }

    // Append number
    this.numpadBuffer += val;
    toast(`Entrée: ${this.numpadBuffer}`, 'info'); // feedback
  },

  /* Restaurant specific methods removed for Retail Pivot */

  saveDeliveryInfo() {
    this.deliveryInfo = {
      nom: document.getElementById('deliveryClientName').value,
      telephone: document.getElementById('deliveryPhone').value,
      adresse: document.getElementById('deliveryAddress').value,
      frais: parseFloat(document.getElementById('deliveryFee').value) || 0
    };
    if (this.orderType === 'livraison' && !this.deliveryInfo.adresse) {
      toast('L\'adresse est requise pour la livraison', 'error');
      return;
    }
    toast('✅ Infos enregistrées', 'success');
    APP.closeModal('deliveryModal');
    // Add delivery fee to cart visually? Or just handle at checkout.
    // For now, let's keep it simple and add it at checkout total.
  },

  openClientSearch(context = 'pos') { // Update openClientSearch signature usage if needed
    this.clientSearchContext = context;
    document.getElementById('clientSearchModal').style.display = 'flex';
    document.getElementById('posClientSearch').focus();
  },

  async init() {
    const orderTypeEl = document.getElementById('orderType');
    if (orderTypeEl) this.orderType = orderTypeEl.value;
    await this.loadCategories();
    await this.loadProducts();
    this.renderCategories();
    this.renderProducts();
    this.renderCart();
    this.initTipSection();
    this.renderFavorites();
    setTimeout(() => this.checkRegisterStatus(), 500);
  },

  /** Favoris — basés sur les produits les plus ajoutés au panier (localStorage) */
  getFavorites() {
    try { return JSON.parse(localStorage.getItem('pos_favorites') || '{}'); } catch (e) { return {}; }
  },

  trackFavorite(productId) {
    const favs = this.getFavorites();
    favs[productId] = (favs[productId] || 0) + 1;
    localStorage.setItem('pos_favorites', JSON.stringify(favs));
  },

  renderFavorites() {
    const bar = document.getElementById('favoritesBar');
    const items = document.getElementById('favoritesItems');
    if (!bar || !items) return;

    const favs = this.getFavorites();
    const sorted = Object.entries(favs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Top 8

    if (sorted.length < 2) { bar.style.display = 'none'; return; }

    // User requested to merge favorites into categories. We will likely ignore this bar.
    bar.style.display = 'none'; // 'flex';
    items.innerHTML = sorted.map(([id, count]) => {
      const p = this.produits.find(x => x.id === parseInt(id));
      if (!p) return '';
      return `<button class="btn btn-sm btn-outline" onclick="POS.addToCart(${p.id})" style="white-space:nowrap;font-size:0.72rem;padding:3px 8px" title="${p.nom} (commandé ${count}x)">${p.nom.substring(0, 15)} · ${p.prix_ttc}DH</button>`;
    }).filter(Boolean).join('');
  },

  async loadCategories() {
    try { this.categories = await api('/categories'); } catch (e) { console.error(e); }
  },

  async loadProducts() {
    try {
      const url = this.currentCategory === 'all' ? '/produits' : `/produits?categorie_id=${this.currentCategory}`;
      this.produits = await api(url);
    } catch (e) { console.error(e); }
  },

  renderCategories() {
    const bar = document.getElementById('categoriesBar');

    // Tout
    let html = `<button class="cat-btn ${this.currentCategory === 'all' ? 'active' : ''}" onclick="POS.selectCategory('all')"><span class="cat-icon">📋</span><span class="cat-name">Tout</span></button>`;

    // Favoris
    html += `<button class="cat-btn ${this.currentCategory === 'favorites' ? 'active' : ''}" onclick="POS.selectCategory('favorites')"><span class="cat-icon">⭐</span><span class="cat-name">Favoris</span></button>`;

    for (const c of this.categories) {
      const isActive = this.currentCategory == c.id;
      html += `<button class="cat-btn ${isActive ? 'active' : ''}" onclick="POS.selectCategory(${c.id})"
        style="${isActive ? 'background:' + c.couleur + ';border-color:' + c.couleur + ';color:#fff;' : ''}">
        <span class="cat-icon">${c.icone}</span><span class="cat-name">${c.nom}</span></button>`;
    }
    bar.innerHTML = html;
  },

  async selectCategory(id) {
    this.currentCategory = id;
    await this.loadProducts();
    this.renderCategories();
    this.renderProducts();
  },

  async loadProducts() {
    try {
      let url;
      if (this.currentCategory === 'all' || this.currentCategory === 'favorites') { // Load all to filter locally for favs
        url = '/produits';
      } else {
        url = `/produits?categorie_id=${this.currentCategory}`;
      }
      this.produits = await api(url);
    } catch (e) { console.error(e); }
  },

  renderProducts(filter = '') {
    const grid = document.getElementById('productsGrid');
    let items = this.produits;

    // Filter by Favorites
    if (this.currentCategory === 'favorites') {
      const favs = this.getFavorites();
      // sort by most ordered
      items = items.filter(p => favs[p.id]).sort((a, b) => (favs[b.id] || 0) - (favs[a.id] || 0));
    }
    if (filter) { const l = filter.toLowerCase(); items = items.filter(p => p.nom.toLowerCase().includes(l)); }
    if (!items.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">🔍</div><p>Aucun produit trouvé</p></div>`;
      return;
    }
    grid.innerHTML = items.map(p => {
      const stockClass = p.stock_quantite <= p.stock_seuil ? 'low' : '';
      return `<div class="product-card" role="button" tabindex="0" aria-label="${p.nom} — ${p.prix_ttc.toFixed(2)} DH" onclick="POS.addToCart(${p.id})" style="--cat-color:${p.categorie_couleur || '#e67e22'}">
        <div class="product-name">${p.nom}</div>
        <div class="product-price">${p.prix_ttc.toFixed(2)} DH</div>
        <div class="product-stock ${stockClass}">${p.stock_quantite > 0 ? 'Stock: ' + p.stock_quantite : '⚠️ Rupture'}</div>
      </div>`;
    }).join('');
  },

  searchProducts(val) { this.renderProducts(val); },

  handleSearchKey(e, val) {
    if (e.key === 'Enter') {
      if (!val) return;
      this.scanBarcode(val);
    }
  },

  /** Scan code-barres — recherche le produit par code et l'ajoute au panier */
  async scanBarcode(code) {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim();

    const clearInput = () => {
      const el = document.getElementById('searchInput'); // Updated ID
      if (el) { el.value = ''; el.focus(); }
      // Clear search results/reset grid if needed
      this.searchProducts('');
    };

    // 1. Check for Scale Barcode (20-29 prefix, 13 digits)
    // Format: PP IIIII VVVVV C (Prefix, Item, Value(Price/Weight), Checksum)
    // Ex: 21 00050 01250 3 -> Item 50, Price 12.50
    if (/^2[0-9]{12}$/.test(cleanCode)) {
      const prefix = cleanCode.substring(0, 2);
      const itemCode = cleanCode.substring(2, 7);
      const valueRaw = cleanCode.substring(7, 12);
      const value = parseInt(valueRaw) / 1000; // Usually 3 decimals for weight (kg) or 2 for price

      // Try scanning by internal item code (which might be the product ID or a short code)
      try {
        // We search by the item code part. In DB, product might be stored as "00050" or "50"
        // Let's assume the product 'code_barre' field holds the 5-digit item code for weighted items.
        // OR strict match on the full code if not a scale item.

        // Search for product with this short code
        const produits = await api(`/produits?search=${encodeURIComponent(itemCode)}`);
        const p = produits.find(x => x.code_barre === itemCode || x.id == parseInt(itemCode));

        if (p) {
          // Found! Add with quantity = value (if weight) or calculate qty from price
          // Defaulting to Weight-based (Prefix 21 often PRICE, but let's assume WEIGHT for now or simple logic)
          // Actually, usually: 
          // 21, 22 = Price embedded? 
          // 23-29 = Weight embedded?
          // Let's implement a simple prompt or logic:
          // If price embedded logic: Qty = Value / UnitPrice
          // If weight embedded logic: Qty = Value

          // Simplified: Assume Weight (kg) for now as it's most common for scales
          // Qty = value (e.g. 1.250 kg)

          this.addToCart(p.id, p, value);
          toast(`✅ ${p.nom} : ${value.toFixed(3)}kg ajouté`, 'success');
          clearInput();
          return;
        }
      } catch (e) { console.error(e); }
    }

    try {
      const produit = await api(`/produits/code-barre/${encodeURIComponent(cleanCode)}`);
      this.addToCart(produit.id, produit);
      toast(`✅ ${produit.nom} ajouté`, 'success');
    } catch (e) {
      // toast(`❌ Code-barres "${cleanCode}" non trouvé`, 'error');
      // If not found as barcode, maybe it was a search intent via Enter?
      // Try searching as name?
      // this.searchProducts(cleanCode); 
      // User requested "Search OR Barcode". If barcode lookup fails, we entered here.
      // But scanBarcode implies exact match. 
      // Let's stick to strict barcode scanning for Enter key as per common POS behavior.
      toast(`❌ Code-barres "${cleanCode}" non trouvé`, 'error');
    }
    clearInput();
  },

  // --- Numpad Logic ---
  numpadBuffer: '',

  numpadAction(val) {
    const display = document.getElementById('numpadDisplay');

    if (val === 'C') {
      this.numpadBuffer = '';
      if (display) display.textContent = '';
      return;
    }

    if (val === 'QTY') {
      // Apply buffer to last item if exists, else ignore
      if (!this.numpadBuffer) return;
      const qty = parseFloat(this.numpadBuffer);
      if (isNaN(qty) || qty <= 0) {
        toast('Quantité invalide', 'warning');
        return;
      }

      if (this.cart.length > 0) {
        const idx = this.cart.length - 1;
        this.cart[idx].quantite = qty;
        this.cart[idx].sous_total_ht = +(this.cart[idx].quantite * this.cart[idx].prix_ht).toFixed(2);
        this.cart[idx].sous_total_ttc = +(this.cart[idx].quantite * this.cart[idx].prix_ttc).toFixed(2);
        this.cart[idx].montant_tva = +(this.cart[idx].sous_total_ttc - this.cart[idx].sous_total_ht).toFixed(2);
        this.renderCart();

        this.numpadBuffer = '';
        if (display) display.textContent = '';
        toast(`Quantité modifiée : ${qty}`, 'success');
      } else {
        toast('Panier vide', 'warning');
      }
      return;
    }

    // Append number
    // Limit length
    if (this.numpadBuffer.length > 5) return;
    this.numpadBuffer += val.toString(); // Ensure string concatenation
    if (display) display.textContent = this.numpadBuffer;
  },

  getPrixSelonTarif(p, tarif) {
    if (tarif === 'gros') return p.prix_gros || p.prix_ttc;
    if (tarif === 'semi_gros') return p.prix_semi_gros || p.prix_ttc;
    return p.prix_ttc;
  },

  setTarif(tarif) {
    this.currentTarif = tarif;
    // Update UI buttons
    document.querySelectorAll('.tariff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tarif === tarif);
      btn.style.background = btn.dataset.tarif === tarif ? 'var(--primary)' : '';
      btn.style.color = btn.dataset.tarif === tarif ? '#fff' : '';
    });

    // Update Cart Prices
    this.cart.forEach(item => {
      // We need original prices. We stored them in item (see addToCart update)
      // fallback to current if not stored (old items)
      const prixBase = this.getPrixSelonTarif({
        prix_ttc: item.prix_unit_detail || item.prix_ttc,
        prix_semi_gros: item.prix_unit_semi,
        prix_gros: item.prix_unit_gros
      }, tarif);

      item.type_tarif = tarif;
      item.prix_ttc = prixBase;
      item.prix_ht = +(prixBase / (1 + (item.taux_tva || 0) / 100)).toFixed(2);

      // Recalc totals
      item.sous_total_ht = +(item.quantite * item.prix_ht).toFixed(2);
      item.sous_total_ttc = +(item.quantite * item.prix_ttc).toFixed(2);
      item.montant_tva = +(item.sous_total_ttc - item.sous_total_ht).toFixed(2);
    });
    this.renderCart();
  },

  addToCart(productId, productObj, quantity = null) {
    const p = productObj || this.produits.find(x => x.id === productId);
    if (!p) return;

    if (this.orderType !== 'retour' && p.stock_quantite <= 0) {
      toast('⚠️ Produit en rupture de stock !', 'error');
      return;
    }

    let qtyToAdd = 1;
    if (quantity !== null) qtyToAdd = quantity;
    else if (this.numpadBuffer) {
      const parsed = parseFloat(this.numpadBuffer);
      if (!isNaN(parsed) && parsed > 0) {
        qtyToAdd = parsed;
        this.numpadBuffer = '';
        const display = document.getElementById('numpadDisplay');
        if (display) display.textContent = '';
      }
    }

    if (this.orderType === 'retour') qtyToAdd = -Math.abs(qtyToAdd);

    this.trackFavorite(p.id);
    const existing = this.cart.find(x => x.produit_id === productId);

    // Calculate Price based on Current Tariff
    const prixApplied = this.getPrixSelonTarif(p, this.currentTarif);

    if (existing) {
      existing.quantite += qtyToAdd;
      existing.quantite = parseFloat(existing.quantite.toFixed(3));
      if (existing.quantite === 0) {
        const idx = this.cart.indexOf(existing);
        if (idx > -1) this.cart.splice(idx, 1);
      } else {
        // Ensure price is up to date with tariff (should be already but strictly speaking)
        existing.prix_ttc = prixApplied;
        existing.prix_ht = +(prixApplied / (1 + (p.taux_tva || 0) / 100)).toFixed(2);

        existing.sous_total_ht = +(existing.quantite * existing.prix_ht).toFixed(2);
        existing.sous_total_ttc = +(existing.quantite * existing.prix_ttc).toFixed(2);
        existing.montant_tva = +(existing.sous_total_ttc - existing.sous_total_ht).toFixed(2);
      }
    } else {
      this.cart.push({
        produit_id: p.id, nom: p.nom,
        prix_ht: +(prixApplied / (1 + (p.taux_tva || 0) / 100)).toFixed(2),
        prix_ttc: prixApplied,
        taux_tva: p.taux_tva || 0,
        // Store variants for switching
        prix_unit_detail: p.prix_ttc,
        prix_unit_semi: p.prix_semi_gros || 0,
        prix_unit_gros: p.prix_gros || 0,
        type_tarif: this.currentTarif,

        quantite: qtyToAdd,
        sous_total_ht: +(+(prixApplied / (1 + (p.taux_tva || 0) / 100)).toFixed(2) * qtyToAdd).toFixed(2),
        sous_total_ttc: +(prixApplied * qtyToAdd).toFixed(2),
        montant_tva: +((prixApplied - (prixApplied / (1 + (p.taux_tva || 0) / 100))) * qtyToAdd).toFixed(2)
      });
    }
    this.renderCart();
  },

  updateQty(i, delta) {
    const item = this.cart[i]; if (!item) return;
    item.quantite += delta;
    item.quantite = parseFloat(item.quantite.toFixed(3));

    if (item.quantite === 0) { this.cart.splice(i, 1); }
    else {
      item.sous_total_ht = +(item.quantite * item.prix_ht).toFixed(2);
      item.sous_total_ttc = +(item.quantite * item.prix_ttc).toFixed(2);
      item.montant_tva = +(item.sous_total_ttc - item.sous_total_ht).toFixed(2);
    }
    this.renderCart();
  },

  // --- Numpad Modal (Touch Friendly) ---
  numpadModalState: {
    value: '',
    callback: null
  },

  openNumpadModal(title, initialValue, callback) {
    this.numpadModalState.value = initialValue ? initialValue.toString() : '';
    this.numpadModalState.callback = callback;

    document.getElementById('numpadTitle').textContent = title;
    document.getElementById('numpadValueDisplay').textContent = this.numpadModalState.value;
    document.getElementById('numpadModal').style.display = 'flex';
  },

  numpadModalAction(val) {
    if (val === 'C') {
      this.numpadModalState.value = '';
    } else if (val === '.') {
      if (!this.numpadModalState.value.includes('.')) {
        this.numpadModalState.value += '.';
      }
    } else {
      // Prevent multiple leading zeros
      if (this.numpadModalState.value === '0' && val !== '.') {
        this.numpadModalState.value = val.toString();
      } else {
        this.numpadModalState.value += val.toString();
      }
    }
    document.getElementById('numpadValueDisplay').textContent = this.numpadModalState.value;
  },

  numpadModalConfirm() {
    const val = parseFloat(this.numpadModalState.value);
    if (isNaN(val)) {
      // Allow empty confirm = cancel or 0? Let's generic handle
      if (this.numpadModalState.callback) this.numpadModalState.callback(null);
    } else {
      if (this.numpadModalState.callback) this.numpadModalState.callback(val);
    }
    APP.closeModal('numpadModal');
  },

  editQuantity(i) {
    const item = this.cart[i];
    // Use new Modal instead of prompt
    this.openNumpadModal(`Quantité: ${item.nom}`, item.quantite, (val) => {
      if (val !== null) {
        const q = parseFloat(val);
        if (!isNaN(q)) {
          if (q <= 0) this.removeFromCart(i);
          else {
            // Set exact quantity
            this.cart[i].quantite = q;
            // Recalc line totals
            this.cart[i].sous_total_ht = +(q * this.cart[i].prix_ht).toFixed(2);
            this.cart[i].sous_total_ttc = +(q * this.cart[i].prix_ttc).toFixed(2);
            this.cart[i].montant_tva = +(this.cart[i].sous_total_ttc - this.cart[i].sous_total_ht).toFixed(2);
            this.renderCart();
          }
        }
      }
    });
  },

  removeFromCart(i) { this.cart.splice(i, 1); this.renderCart(); },

  clearCart() {
    if (!this.cart.length) return;
    this.cart = []; this.discount = null; this.selectedClient = null;
    this.deliveryInfo = null; this.orderType = 'emporter'; // Default retail
    document.getElementById('cartClient').style.display = 'none';
    document.getElementById('remiseRow').style.display = 'none';
    this.renderCart(); this.hideChangeSection();
  },

  getTotals() {
    const totalHt = this.cart.reduce((s, i) => s + i.sous_total_ht, 0);
    const totalTtc = this.cart.reduce((s, i) => s + i.sous_total_ttc, 0);
    const totalTva = +(totalTtc - totalHt).toFixed(2);
    let remise = 0;
    if (this.discount) {
      if (this.discount.type === 'pourcentage') remise = +(totalTtc * this.discount.valeur / 100).toFixed(2);
      else remise = Math.min(this.discount.valeur, totalTtc);
    }
    const total = +(totalTtc - remise).toFixed(2);
    return { totalHt: +totalHt.toFixed(2), totalTva, totalTtc: +totalTtc.toFixed(2), remise, total };
  },

  renderCart() {
    const container = document.getElementById('cartItems');
    const btnE = document.getElementById('btnEspeces');
    const btnC = document.getElementById('btnCarte');

    if (!this.cart.length) {
      container.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span><p>Aucun article</p></div>`;
      document.getElementById('subtotalHT').textContent = '0.00 DH';
      document.getElementById('totalTVA').textContent = '0.00 DH';
      document.getElementById('totalAmount').textContent = '0.00 DH';
      document.getElementById('totalAmount').style.color = ''; // Reset

      if (btnE) btnE.disabled = true;
      if (btnC) btnC.disabled = true;
      const btnM = document.getElementById('btnMixte'); if (btnM) btnM.disabled = true;

      const btnPay = document.getElementById('btnGlobalPay');
      if (btnPay) {
        btnPay.disabled = true;
        document.getElementById('payBtnAmount').textContent = '0.00 DH';
        btnPay.innerHTML = `💵 PAYER <span id="payBtnAmount" style="font-weight:400;margin-left:8px">0.00 DH</span>`;
        btnPay.style.background = 'var(--success)';
      }
      return;
    }

    container.innerHTML = this.cart.map((item, i) => `
      <div class="cart-item" onclick="POS.editQuantity(${i})" style="cursor:pointer;${item.quantite < 0 ? 'background:#fff0f0;border-left:4px solid var(--danger)' : ''}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nom} ${item.quantite < 0 ? '<small class="text-danger">(RETOUR)</small>' : ''}</div>
          <div class="cart-item-price">${item.prix_ttc.toFixed(2)} DH${item.taux_tva ? ' <small>(TVA ' + item.taux_tva + '%)</small>' : ''}</div>
        </div>
        <div class="cart-item-qty">
          <button onclick="event.stopPropagation(); POS.updateQty(${i},-1)">−</button>
          <span>${item.quantite}</span>
          <button onclick="event.stopPropagation(); POS.updateQty(${i},1)">+</button>
        </div>
        <div class="cart-item-total" style="${item.sous_total_ttc < 0 ? 'color:var(--danger)' : ''}">${item.sous_total_ttc.toFixed(2)}</div>
        <button class="cart-item-remove" onclick="event.stopPropagation(); POS.removeFromCart(${i})">✕</button>
      </div>
    `).join('');

    const t = this.getTotals();
    document.getElementById('subtotalHT').textContent = t.totalHt.toFixed(2) + ' DH';
    document.getElementById('totalTVA').textContent = t.totalTva.toFixed(2) + ' DH';
    document.getElementById('totalAmount').textContent = t.total.toFixed(2) + ' DH';

    // Style Total if negative
    const totalEl = document.getElementById('totalAmount');
    if (t.total < 0) {
      totalEl.style.color = 'var(--danger)';
    } else {
      totalEl.style.color = 'var(--primary)';
    }

    if (t.remise > 0) {
      document.getElementById('remiseRow').style.display = 'flex';
      document.getElementById('remiseAmount').textContent = '-' + t.remise.toFixed(2) + ' DH';
    } else {
      document.getElementById('remiseRow').style.display = 'none';
    }

    if (btnE) btnE.disabled = false;
    if (btnC) btnC.disabled = false;
    const btnM = document.getElementById('btnMixte'); if (btnM) btnM.disabled = false;

    // Update Global Pay Button - Safely
    const btnPay = document.getElementById('btnGlobalPay');
    if (btnPay) {
      btnPay.disabled = false;

      if (t.total < 0) {
        btnPay.innerHTML = `↩️ REMBOURSER <span id="payBtnAmount" style="font-weight:400;margin-left:8px">${Math.abs(t.total).toFixed(2)} DH</span>`;
        btnPay.style.background = 'var(--warning)';
      } else {
        btnPay.innerHTML = `💵 PAYER <span id="payBtnAmount" style="font-weight:400;margin-left:8px">${t.total.toFixed(2)} DH</span>`;
        btnPay.style.background = 'var(--success)';
      }
    }

    // Auto-scroll
    container.scrollTop = container.scrollHeight;
  },

  setOrderType(v) { this.orderType = v; },

  // --- Client ---
  openClientSearch() {
    document.getElementById('posClientSearch').value = '';
    document.getElementById('posClientResults').innerHTML = '<p class="text-muted text-center">Tapez un nom ou téléphone...</p>';
    document.getElementById('clientSearchModal').style.display = 'flex';
    document.getElementById('posClientSearch').focus();
  },

  async searchClient(val) {
    if (val.length < 2) return;
    try {
      const clients = await api(`/clients?search=${encodeURIComponent(val)}`);
      const el = document.getElementById('posClientResults');
      if (!clients.length) { el.innerHTML = '<p class="text-muted text-center">Aucun client trouvé</p>'; return; }
      el.innerHTML = clients.map(c => `
        <div class="cart-item" style="cursor:pointer" onclick="POS.selectClient(${c.id}, '${c.nom.replace(/'/g, "\\'")}', ${c.points_fidelite}, '${c.type_tarif}')">
          <div class="cart-item-info">
            <div class="cart-item-name">${c.nom}</div>
            <div class="cart-item-price">${c.telephone || '—'} | ${c.points_fidelite} pts | ${c.nb_visites} visites</div>
          </div>
          <span class="badge badge-${c.points_fidelite >= 500 ? 'warning' : c.points_fidelite >= 100 ? 'info' : 'success'}">${c.points_fidelite >= 500 ? '⭐ Gold' : c.points_fidelite >= 100 ? '🥈 Silver' : '🥉 Bronze'}</span>
        </div>
      `).join('');
    } catch (e) { console.error(e); }
  },

  selectClient(id, nom, points, type_tarif = 'particulier') {
    this.selectedClient = { id, nom, points, type_tarif };
    // Apply client's tariff
    this.setTarif(type_tarif || 'particulier');
    document.getElementById('cartClient').style.display = 'flex';
    document.getElementById('cartClientName').textContent = nom;
    document.getElementById('cartClientPoints').textContent = points + ' pts';
    APP.closeModal('clientSearchModal');
  },

  removeClient() {
    this.selectedClient = null;
    this.setTarif('particulier'); // Reset to default
    document.getElementById('cartClient').style.display = 'none';
  },

  // --- Discount ---
  openDiscountModal() {
    document.getElementById('discountValue').value = '';
    // Charger promotions actives
    api('/remises').then(remises => {
      const el = document.getElementById('activePromotions');
      if (remises.length) {
        el.innerHTML = '<h4 class="mb-8">Promotions actives:</h4>' + remises.map(r => `
          <div class="cart-item" style="cursor:pointer" onclick="POS.applyPromotion(${r.id}, '${r.type}', ${r.valeur})">
            <div class="cart-item-info">
              <div class="cart-item-name">${r.nom}</div>
              <div class="cart-item-price">${r.type === 'pourcentage' ? r.valeur + '%' : r.valeur + ' DH'}</div>
            </div>
            <span class="badge badge-warning">Appliquer</span>
          </div>
        `).join('');
      } else { el.innerHTML = ''; }
    }).catch(() => { });
    document.getElementById('discountModal').style.display = 'flex';
  },

  applyDiscount() {
    const type = document.getElementById('discountType').value;
    const val = parseFloat(document.getElementById('discountValue').value);
    if (!val || val <= 0) { toast('Valeur invalide', 'error'); return; }
    this.discount = { type, valeur: val };
    this.renderCart();
    APP.closeModal('discountModal');
    toast('🏷️ Remise appliquée', 'success');
  },

  applyPromotion(id, type, valeur) {
    this.discount = { type, valeur };
    this.renderCart();
    APP.closeModal('discountModal');
    toast('🏷️ Promotion appliquée', 'success');
  },

  removeDiscount() {
    this.discount = null;
    document.getElementById('remiseRow').style.display = 'none';
    this.renderCart();
  },

  // --- Pourboire ---
  currentTip: 0,

  setTip(amount) {
    this.currentTip = Math.max(0, amount);
    const display = document.getElementById('tipDisplay');
    if (display) display.textContent = this.currentTip > 0 ? `+${this.currentTip.toFixed(2)} DH` : '';
    // Highlight active tip button
    document.querySelectorAll('#tipSection .btn-sm').forEach(b => b.classList.remove('btn-primary'));
  },

  initTipSection() {
    const tipSection = document.getElementById('tipSection');
    if (!tipSection) return;
    // Afficher la section pourboire si le profil l'active
    if (PARAMS.feature_pourboire === '1') {
      tipSection.style.display = 'block';
    }
  },

  // --- Park / Hold Orders ---
  async parkOrder() {
    if (!this.cart.length) { toast('Panier vide', 'warning'); return; }

    // Optional: Ask for a reference note
    const note = await APP.prompt('Mettre en attente', 'Note pour retrouver la commande (Nom client, etc.) :');
    if (note === null) return; // Cancelled

    const t = this.getTotals();
    const payload = {
      lignes: this.cart.map(i => ({ produit_id: i.produit_id, quantite: i.quantite, type_tarif: i.type_tarif, notes: '' })),
      mode_paiement: 'attente',
      type_commande: this.orderType,
      client_id: this.selectedClient ? this.selectedClient.id : null,
      client_nom: this.selectedClient ? this.selectedClient.nom : '',
      montant_recu: 0,
      remise_montant: t.remise,
      remise_type: this.discount ? this.discount.type : '',
      notes: note || 'Commande en attente',
      type_tarif: this.currentTarif,
      statut: 'attente'
    };

    try {
      await api('/commandes', { method: 'POST', body: payload });
      toast('⏳ Commande mise en attente', 'success');
      this.clearCart();
    } catch (e) {
      toast('Erreur: ' + e.message, 'error');
    }
  },

  async showParkedOrders() {
    viewLoading('parkedOrdersList');
    document.getElementById('parkedOrdersModal').style.display = 'flex';
    try {
      const orders = await api('/commandes?statut=attente');
      const list = document.getElementById('parkedOrdersList');
      if (!orders.length) {
        list.innerHTML = '<div class="text-muted text-center p-20">Aucune commande en attente</div>';
        return;
      }
      list.innerHTML = orders.map(o => `
        <div class="cart-item" style="flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;width:100%">
            <strong>${o.notes || 'Sans note'}</strong>
            <span class="badge badge-warning">${new Date(o.date_creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="display:flex;justify-content:space-between;width:100%;color:var(--text-muted);font-size:0.9rem">
            <span>${o.numero} · ${o.client_nom || 'Client Inconnu'}</span>
            <strong>${o.total.toFixed(2)} DH</strong>
          </div>
          <button class="btn btn-sm btn-primary btn-block" onclick="POS.resumeOrder(${o.id})">📂 Reprendre</button>
        </div>
      `).join('');
    } catch (e) {
      toast('Erreur: ' + e.message, 'error');
      APP.closeModal('parkedOrdersModal');
    }
  },

  async resumeOrder(id) {
    try {
      // 1. Fetch details
      const order = await api(`/commandes/${id}`);
      if (!order) throw new Error('Commande introuvable');

      // 2. Check cart
      if (this.cart.length > 0) {
        const ok = await confirmDialog('Panier non vide', 'Voulez-vous écraser le panier actuel ?');
        if (!ok) return;
      }
      this.clearCart();

      // 3. Load items
      this.cart = order.lignes.map(l => ({
        produit_id: l.produit_id,
        nom: l.nom_produit || l.produit_nom,
        prix_ht: l.prix_unitaire_ht,
        prix_ttc: l.prix_unitaire_ttc,
        taux_tva: l.taux_tva,
        quantite: l.quantite,
        sous_total_ht: l.sous_total_ht, // Recalc later? Trusted from DB
        sous_total_ttc: l.sous_total_ttc,
        montant_tva: l.montant_tva
      }));

      // Load context
      if (order.client_id) {
        this.selectedClient = { id: order.client_id, nom: order.client_nom, points: 0 };
        document.getElementById('cartClient').style.display = 'flex';
        document.getElementById('cartClientName').textContent = order.client_nom;
      }

      this.renderCart();

      // 4. Cancel the parked order (Release Stock)
      // This is crucial because parking reserved the stock.
      // Resuming puts it back in "memory cart" (uncommitted), so we must release the DB reservation.
      await api(`/commandes/${id}/annuler`, { method: 'PUT' });

      APP.closeModal('parkedOrdersModal');
      toast('Commande reprise', 'success');

    } catch (e) {
      toast('Erreur: ' + e.message, 'error');
    }
  },

  // --- New Payment Modal Logic ---
  pmTendered: 0,
  pmBuffer: '0',

  openPaymentModal() {
    if (!this.cart.length) return;
    const t = this.getTotals();
    this.pmTendered = 0;
    this.pmBuffer = '0';

    const isRefund = t.total < 0;
    const absTotal = Math.abs(t.total);

    const titleEl = document.querySelector('#paymentModal h2');
    if (titleEl) titleEl.textContent = isRefund ? '↩️ Remboursement' : '💳 Paiement';

    document.getElementById('pmTotalToPay').textContent = absTotal.toFixed(2) + ' DH';
    this.pmUpdateDisplay();
    document.getElementById('paymentModal').style.display = 'flex';
  },

  pmNumpad(val) {
    if (val === 'C') { this.pmBuffer = '0'; }
    else if (val === '.') {
      if (!this.pmBuffer.includes('.')) this.pmBuffer += '.';
    }
    else {
      if (this.pmBuffer === '0') this.pmBuffer = val;
      else this.pmBuffer += val;
    }
    this.pmTendered = parseFloat(this.pmBuffer);
    this.pmUpdateDisplay();
  },

  pmFastCash(amount) {
    this.pmTendered += amount;
    this.pmBuffer = this.pmTendered.toString();
    this.pmUpdateDisplay();
  },

  pmUpdateDisplay() {
    document.getElementById('pmTenderDisplay').textContent = this.pmTendered.toFixed(2);
    const t = this.getTotals();
    const absTotal = Math.abs(t.total);
    const change = this.pmTendered - absTotal;

    const changeEl = document.getElementById('pmChangeDisplay');
    if (change >= 0) {
      changeEl.style.display = 'block';
      document.getElementById('pmChangeAmount').textContent = change.toFixed(2) + ' DH';
    } else {
      changeEl.style.display = 'none';
    }
  },

  hideChangeSection() {
    const el = document.getElementById('pmChangeDisplay');
    if (el) el.style.display = 'none';
  },

  async pmValidate(mode) {
    this.currentPaymentMode = mode;
    const t = this.getTotals();
    const absTotal = Math.abs(t.total);

    let amountToProcess = this.pmTendered;

    if (mode === 'especes') {
      if (this.pmTendered < absTotal) {
        toast('Montant insuffisant !', 'warning');
        return;
      }
    } else {
      // For Card/Other, defaulting to Total if 0 entered
      if (amountToProcess === 0) amountToProcess = absTotal;
    }

    const genFacture = document.getElementById('pmGenerateFacture').checked;
    APP.closeModal('paymentModal');
    await this.confirmPayment(amountToProcess, genFacture);
  },

  async confirmPayment(amountOverride = null, generateFacture = false) {
    if (!this.cart.length) return;
    const t = this.getTotals();

    // Use override if provided, else total (for card which doesn't need input)
    // If amountOverride is 0 (exact count) or null, use total for Cards. 
    // For Cash, amountOverride usually > total.

    let mRecu = amountOverride !== null ? amountOverride : Math.abs(t.total);

    // If Refund, sign the amount received (paid out)
    if (t.total < 0) {
      mRecu = -Math.abs(mRecu);
    }

    const payload = {
      lignes: this.cart.map(i => ({ produit_id: i.produit_id, quantite: i.quantite, type_tarif: i.type_tarif })),
      mode_paiement: this.currentPaymentMode,
      type_commande: this.orderType,
      client_id: this.selectedClient ? this.selectedClient.id : null,
      client_nom: this.selectedClient ? this.selectedClient.nom : '',
      montant_recu: mRecu,
      remise_montant: t.remise,
      remise_type: this.discount ? this.discount.type : '',
      notes: '',
      type_tarif: this.currentTarif,
      pourboire: this.currentTip || 0,
      generate_facture: generateFacture
    };

    // Support paiement mixte (Legacy logic support, though blocked in UI now)
    if (this.currentPaymentMode === 'mixte') {
      payload.montant_especes = this._mixteEspeces || 0;
      payload.montant_carte = this._mixteCarte || 0;
      payload.montant_recu = t.total;
    }

    try {
      // 1. Créer la commande
      const result = await api('/commandes', { method: 'POST', body: payload });

      // 2. Si livraison, créer l'enregistrement livraison
      if (this.orderType === 'livraison' && this.deliveryInfo) {
        try {
          await api('/livraisons', {
            method: 'POST',
            body: {
              commande_id: result.id,
              adresse: this.deliveryInfo.adresse,
              telephone: this.deliveryInfo.telephone,
              frais_livraison: this.deliveryInfo.frais,
              notes: this.deliveryInfo.notes || ''
            }
          });
        } catch (e) {
          console.error('Erreur création livraison:', e);
          toast('Commande créée mais erreur info livraison', 'warning');
        }
      }

      this.lastOrder = { ...result, mode_paiement: this.currentPaymentMode, montant_recu: mRecu, numero_facture: result.numero_facture };
      this.hideChangeSection();
      this.cart = []; this.discount = null; this.selectedClient = null; this.currentTip = 0;
      this.deliveryInfo = null; this.orderType = 'emporter'; // Reset defaults
      document.getElementById('cartClient').style.display = 'none';
      document.getElementById('remiseRow').style.display = 'none';
      this.renderCart();

      // Rafraîchir les produits (stock)
      this.loadProducts().then(() => this.renderProducts());
      APP.checkStockAlerts();

      // Afficher succès
      const modeLabel = this.currentPaymentMode === 'especes' ? '💵 Espèces' : this.currentPaymentMode === 'mixte' ? '🔀 Mixte' : '💳 Carte';
      document.getElementById('successDetails').innerHTML = `
        <p><strong>${result.numero}</strong></p>
        <p>HT: ${result.sous_total.toFixed(2)} DH | TVA: ${result.total_tva.toFixed(2)} DH</p>
        ${result.remise > 0 ? `<p>Remise: -${result.remise.toFixed(2)} DH</p>` : ''}
        <p><strong>Total: ${result.total.toFixed(2)} DH</strong> — ${modeLabel}</p>
        ${result.monnaie_rendue > 0 ? `<p>Monnaie: ${result.monnaie_rendue.toFixed(2)} DH</p>` : ''}
        ${result.points_gagnes ? `<p>⭐ +${result.points_gagnes} points fidélité</p>` : ''}
        ${this.orderType === 'livraison' ? '<p class="text-info mt-8">📦 Livraison enregistrée</p>' : ''}
      `;
      document.getElementById('successModal').style.display = 'flex';
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  },

  printLastTicket() {
    if (!this.lastOrder) return;
    const o = this.lastOrder;
    const P = PARAMS;
    const on = (key) => P[key] !== '0'; // Vérifie si option activée
    const devise = P.devise || 'DH';
    const fontSize = parseInt(P.ticket_font_size) || 13;
    const largeur = parseInt(P.ticket_largeur) || 300;

    // Construire les lignes articles
    let articlesHtml = '';
    if (on('ticket_show_articles') && o.lignes && o.lignes.length) {
      articlesHtml = `
        <div class="sep"></div>
        <div class="line header-row"><span class="col-name">ARTICLE</span><span class="col-qty">QTÉ</span><span class="col-price">MONTANT</span></div>
        <div class="sep"></div>`;
      o.lignes.forEach(l => {
        articlesHtml += `<div class="article-row">
          <div class="line"><span class="col-name bold">${l.nom_produit}</span><span class="col-qty">x${l.quantite}</span><span class="col-price bold">${(l.sous_total_ttc || 0).toFixed(2)}</span></div>
          ${on('ticket_show_tva_detail') ? `<div class="tva-detail">  P.U: ${(l.prix_unitaire_ttc || 0).toFixed(2)} ${devise} | TVA ${l.taux_tva || 0}%</div>` : ''}
        </div>`;
      });
    }

    const w = window.open('', '_blank', 'width=380,height=700');
    w.document.write(`<html><head><title>Ticket — ${o.numero}</title><style>
      @page { margin: 2mm; size: ${largeur}px auto; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Consolas', 'Courier New', 'Lucida Console', monospace;
        font-size: ${fontSize}px;
        font-weight: 600;
        line-height: 1.5;
        padding: 8px;
        max-width: ${largeur}px;
        margin: 0 auto;
        color: #000;
        -webkit-print-color-adjust: exact;
      }
      .center { text-align: center; }
      .bold { font-weight: 900; }
      .sep { border-top: 2px dashed #000; margin: 6px 0; }
      .sep-double { border-top: 3px double #000; margin: 8px 0; }
      .line { display: flex; justify-content: space-between; align-items: baseline; padding: 1px 0; }
      .big { font-size: ${fontSize + 5}px; font-weight: 900; letter-spacing: 0.5px; }
      .commerce-name { font-size: ${fontSize + 6}px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
      .commerce-info { font-size: ${fontSize - 1}px; font-weight: 600; }
      .header-row { font-size: ${fontSize - 1}px; font-weight: 900; text-transform: uppercase; }
      .col-name { flex: 1; text-align: left; }
      .col-qty { width: 40px; text-align: center; }
      .col-price { width: 70px; text-align: right; }
      .article-row { padding: 2px 0; border-bottom: 1px dotted #ccc; }
      .article-row:last-child { border-bottom: none; }
      .tva-detail { font-size: ${fontSize - 2}px; font-weight: 400; color: #555; padding-left: 4px; }
      .total-section .line { font-weight: 700; padding: 2px 0; }
      .total-line { font-size: ${fontSize + 5}px; font-weight: 900; padding: 4px 0; }
      .footer { margin-top: 8px; font-size: ${fontSize - 1}px; }
      .promo { font-weight: 700; font-size: ${fontSize}px; margin: 6px 0; padding: 4px; border: 1px dashed #000; text-align: center; }
    </style></head><body>

      ${on('ticket_show_logo') ? `<div class="center commerce-name">${P.nom_commerce || 'RITAJ SMART POS'}</div>` : ''}
      ${on('ticket_show_adresse') ? `<div class="center commerce-info">${P.adresse || ''}</div>` : ''}
      ${on('ticket_show_telephone') ? `<div class="center commerce-info">Tél: ${P.telephone || ''}</div>` : ''}
      ${on('ticket_show_ice') ? `<div class="center commerce-info">ICE: ${P.ice || ''}</div>` : ''}
      ${on('ticket_show_header') && P.ticket_header ? `<div class="center bold" style="margin-top:4px">${P.ticket_header}</div>` : ''}

      <div class="sep-double"></div>
      
      <div class="center bold" style="font-size: ${fontSize + 2}px; margin-bottom: 8px;">${o.numero_facture ? 'FACTURE' : 'REÇU DE VENTE'}</div>

      ${on('ticket_show_numero') ? `<div class="line"><span>N° Commande:</span><span class="bold">${o.numero}</span></div>` : ''}
      ${o.numero_facture ? `<div class="line"><span>N° Facture:</span><span class="bold">${o.numero_facture}</span></div>` : ''}
      ${on('ticket_show_date_heure') ? `<div class="line"><span>${new Date().toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}</span><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>` : ''}
      ${on('ticket_show_caissier') && o.caissier_nom ? `<div class="line"><span>Caissier:</span><span class="bold">${o.caissier_nom}</span></div>` : ''}
      ${on('ticket_show_client') && o.client_nom ? `<div class="line"><span>Client:</span><span class="bold">${o.client_nom}</span></div>` : ''}
      ${on('ticket_show_type_cmd') ? `<div class="line"><span>Cmd:</span><span>${o.type_commande === 'emporter' ? '🛍️ Emporter' : o.type_commande === 'livraison' ? '🚗 Livraison' : '🏠 Sur place'}</span></div>` : ''}
      ${o.table_id ? `<div class="line bold" style="font-size:${fontSize + 2}px"><span>📍 TABLE:</span><span>${o.table_nom || o.table_id}</span></div>` : ''}

      ${articlesHtml}

      <div class="sep-double"></div>
      <div class="total-section">
        ${on('ticket_show_ht') ? `<div class="line"><span>Sous-total HT</span><span>${o.sous_total.toFixed(2)} ${devise}</span></div>` : ''}
        ${on('ticket_show_ht') ? `<div class="line"><span>TVA</span><span>${o.total_tva.toFixed(2)} ${devise}</span></div>` : ''}
        ${on('ticket_show_remise') && o.remise > 0 ? `<div class="line"><span>Remise</span><span>-${o.remise.toFixed(2)} ${devise}</span></div>` : ''}
        <div class="sep"></div>
        <div class="line total-line"><span>TOTAL TTC</span><span>${o.total.toFixed(2)} ${devise}</span></div>
      </div>
      <div class="sep-double"></div>

      ${on('ticket_show_mode_paiement') ? `<div class="line bold"><span>Paiement</span><span>${o.mode_paiement === 'especes' ? '💵 Espèces' : '💳 Carte'}</span></div>` : ''}
      ${on('ticket_show_monnaie') && o.montant_recu > 0 ? `<div class="line"><span>Reçu</span><span>${o.montant_recu.toFixed(2)} ${devise}</span></div>` : ''}
      ${on('ticket_show_monnaie') && o.monnaie_rendue > 0 ? `<div class="line bold"><span>Monnaie</span><span>${o.monnaie_rendue.toFixed(2)} ${devise}</span></div>` : ''}
      ${on('ticket_show_points') && o.points_gagnes ? `<div class="line"><span>⭐ Points fidélité</span><span>+${o.points_gagnes}</span></div>` : ''}

      <div class="sep"></div>
      ${on('ticket_show_footer') ? `<div class="center footer bold">${P.ticket_footer || 'Merci de votre visite ! 🍞'}</div>` : ''}
      ${P.ticket_message_promo ? `<div class="promo">${P.ticket_message_promo}</div>` : ''}

    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  },

  // ════════ CASH MANAGEMENT & Z-REPORT ════════

  registerStatus: 'fermee',

  async checkRegisterStatus() {
    try {
      const res = await api('/caisse/statut');
      this.registerStatus = res.statut;

      if (res.statut === 'fermee') {
        this.showOpenRegisterModal();
      } else {
        // If open, maybe update UI indicator?
      }
    } catch (e) { console.error('Check register failed', e); }
  },

  showOpenRegisterModal() {
    document.getElementById('openRegisterModal').style.display = 'flex';
    setTimeout(() => document.getElementById('openRegisterFund').focus(), 100);
  },

  async openRegister() {
    const fond = parseFloat(document.getElementById('openRegisterFund').value) || 0;
    try {
      await api('/caisse/ouvrir', { method: 'POST', body: { fond_caisse: fond } });
      toast('✅ Caisse ouverte avec succès', 'success');
      document.getElementById('openRegisterModal').style.display = 'none';
      this.registerStatus = 'ouverte';
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async closeRegister() {
    try {
      const zParams = await api('/stats/z');
      const c = zParams.caisse;
      const fmt = (n) => (n || 0).toFixed(2) + ' DH';

      document.getElementById('closeRegFund').textContent = fmt(c.fond_initial);
      document.getElementById('closeRegCashSales').textContent = fmt(c.ventes_especes);
      document.getElementById('closeRegDepots').textContent = fmt(c.depots);
      document.getElementById('closeRegRetraits').textContent = fmt(c.retraits);
      document.getElementById('closeRegTheoretical').textContent = fmt(c.theorique);

      document.getElementById('closeRegReal').value = '';
      document.getElementById('closeRegDiff').textContent = 'Ecart: 0.00 DH';
      document.getElementById('closeRegDiff').className = '';

      document.getElementById('closeRegisterModal').style.display = 'flex';
      setTimeout(() => document.getElementById('closeRegReal').focus(), 100);
    } catch (e) { toast('Erreur charge cloture: ' + e.message, 'error'); }
  },

  calcCloseDiff() {
    const theoriqueStr = document.getElementById('closeRegTheoretical').textContent.replace(' DH', '');
    const theorique = parseFloat(theoriqueStr) || 0;
    const reel = parseFloat(document.getElementById('closeRegReal').value) || 0;
    const diff = reel - theorique;
    const el = document.getElementById('closeRegDiff');
    el.textContent = `Ecart: ${diff.toFixed(2)} DH`;
    el.className = diff < -0.01 ? 'text-danger' : diff > 0.01 ? 'text-success' : 'text-muted';
  },

  async closeRegisterConfirm() {
    if (!await confirmDialog('Clôturer la caisse ?', "Cette action est irréversible. Assurez-vous d'avoir compté le fond de caisse.")) return;

    const montant_reel = parseFloat(document.getElementById('closeRegReal').value) || 0;
    const notes = document.getElementById('closeRegNotes').value;

    try {
      await api('/caisse/fermer', { method: 'POST', body: { montant_reel, notes } });
      toast('✅ Caisse clôturée', 'success');
      document.getElementById('closeRegisterModal').style.display = 'none';
      this.registerStatus = 'fermee';

      if (await confirmDialog('Imprimer Z ?', 'Voulez-vous imprimer le rapport de clôture ?')) {
        await this.printZReport();
      }

      setTimeout(() => window.location.reload(), 2000);
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  openCashMovementModal() {
    document.getElementById('cashMvtAmount').value = '';
    document.getElementById('cashMvtReason').value = '';
    document.getElementById('cashMovementModal').style.display = 'flex';
    setTimeout(() => document.getElementById('cashMvtAmount').focus(), 100);
  },

  async saveCashMovement() {
    const type = document.getElementById('cashMvtType').value;
    const montant = parseFloat(document.getElementById('cashMvtAmount').value);
    const motif = document.getElementById('cashMvtReason').value;

    if (!montant || montant <= 0) return toast('Montant invalide', 'warning');

    try {
      await api('/caisse/mouvements', { method: 'POST', body: { type, montant, motif } });
      toast('✅ Mouvement enregistré', 'success');
      APP.closeModal('cashMovementModal');
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async printZReport() {
    try {
      const zData = await api('/stats/z');
      const dateStr = new Date().toLocaleString();
      const fmt = (n) => (n || 0).toFixed(2);

      let html = `
            <html><head><title>Z-REPORT</title>
            <style>
              body { font-family: monospace; width: 300px; margin: 0 auto; font-size: 12px; }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              hr { border: 1px dashed #000; }
              .row { display: flex; justify-content: space-between; }
            </style>
            </head><body>
            <div class="center">
              <h3>RAPPORT Z (CLÔTURE)</h3>
              <p>\${dateStr}</p>
              <p>Caissier: \${USER.nom}</p>
            </div>
            <hr>
            <div class="row"><span>Ventes Brut:</span><span>\${fmt(zData.sales.brut)}</span></div>
            <div class="row"><span>Retours:</span><span>\${fmt(zData.sales.retours.montant)}</span></div>
            <div class="row bold"><span>Ventes Net:</span><span>\${fmt(zData.sales.net)}</span></div>
            <div class="row"><span>Nb Commandes:</span><span>\${zData.sales.nb_commandes}</span></div>
            <div class="row"><span>Panier Moyen:</span><span>\${fmt(zData.sales.panier_moyen)}</span></div>
            <hr>
            <div class="center bold">ENCAISSEMENTS</div>
            \${zData.payments.map(p =>
        \`<div class="row"><span>\${p.mode_paiement.toUpperCase()}:</span><span>\${fmt(p.montant)}</span></div>\`
      ).join('')}
            <hr>
            <div class="center bold">CAISSE (ESPÈCES)</div>
            <div class="row"><span>Fond Initial:</span><span>\${fmt(zData.caisse.fond_initial)}</span></div>
            <div class="row"><span>+ Espèces:</span><span>\${fmt(zData.caisse.ventes_especes)}</span></div>
            <div class="row"><span>+ Dépôts:</span><span>\${fmt(zData.caisse.depots)}</span></div>
            <div class="row"><span>- Retraits:</span><span>\${fmt(zData.caisse.retraits)}</span></div>
            <div class="row bold"><span>= THÉORIQUE:</span><span>\${fmt(zData.caisse.theorique)}</span></div>
            \${zData.caisse.reel ? \`<div class="row"><span>= RÉEL:</span><span>\${fmt(zData.caisse.reel)}</span></div>\` : ''}
            \${zData.caisse.ecart ? \`<div class="row"><span>= ÉCART:</span><span>\${fmt(zData.caisse.ecart)}</span></div>\` : ''}
            <hr>
            <div class="center">*** FIN RAPPORT ***</div>
            <br><br>
            </body></html>
           `;

      const win = window.open('', 'PrintZ', 'width=400,height=600');
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); win.close(); }, 500);

    } catch (e) { toast('Erreur impression Z: ' + e.message, 'error'); }
  }
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                     HISTORY                               ║
// ╚═══════════════════════════════════════════════════════════╝

const HISTORY = {
  selectedOrders: new Set(),

  loadWithClient(clientId) {
    this.selectedOrders.clear();
    // Pre-fill search or just use clientId in load
    this.load(clientId);
  },

  async load(clientId = null) {
    viewLoading('historyBody');
    const date = document.getElementById('historyDate').value;
    const dateFin = document.getElementById('historyDateFin').value;
    const statut = document.getElementById('historyStatut').value;
    const search = document.getElementById('historySearch').value;

    let url = '/commandes?';
    if (clientId) url += `client_id=${clientId}&`;
    if (date) url += `date_debut=${date}&`;
    if (dateFin) url += `date_fin=${dateFin}&`;
    if (statut) url += `statut=${statut}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    try {
      const commandes = await api(url);
      const body = document.getElementById('historyBody');
      if (!commandes.length) {
        body.innerHTML = '<p class="text-center text-muted p-16">Aucune commande trouvée</p>';
        this.updateSelectionUI();
        return;
      }

      body.innerHTML = `<div class="table-responsive"><table class="data-table">
        <thead><tr>
          <th style="width:40px"><input type="checkbox" onchange="HISTORY.toggleAll(this.checked)"></th>
          <th>N°</th><th>Date</th><th>Type</th><th>Total</th><th>Paiement</th><th>Caissier</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>${commandes.map(c => `<tr>
          <td><input type="checkbox" class="order-checkbox" data-id="${c.id}" ${this.selectedOrders.has(c.id) ? 'checked' : ''} onchange="HISTORY.toggleOrder(${c.id}, this.checked)"></td>
          <td><strong>${c.numero}</strong><br><small class="text-muted">${c.client_nom || ''}</small></td>
          <td>${new Date(c.date_creation).toLocaleString('fr-FR')}</td>
          <td>${c.type_commande === 'emporter' ? '🛍️' : c.type_commande === 'livraison' ? '🚗' : '🏠'}</td>
          <td><strong>${(c.total || 0).toFixed(2)} DH</strong></td>
          <td>${c.mode_paiement === 'especes' ? '💵' : '💳'} ${c.mode_paiement}</td>
          <td>${c.caissier_nom || '—'}</td>
          <td><span class="badge badge-${c.statut === 'payee' ? 'success' : 'danger'}">${c.statut}</span></td>
          <td class="actions">
            <button class="btn btn-sm btn-outline" onclick="HISTORY.detail(${c.id})" title="Détails">👁️</button>
            <button class="btn btn-sm btn-outline" onclick="HISTORY.printReceipt(${c.id})" title="Reçu Thermique">🧾</button>
            ${c.numero_facture
          ? `<button class="btn btn-sm btn-info" onclick="HISTORY.exportPDF(${c.id})" title="Facture PDF (${c.numero_facture})">📄</button>`
          : `<button class="btn btn-sm btn-outline" onclick="HISTORY.generateFacture(${c.id})" title="Générer Facture">➕📄</button>`
        }
            ${c.statut !== 'annulee' && (USER.role === 'admin' || USER.role === 'manager') ? `<button class="btn btn-sm btn-danger" onclick="HISTORY.annuler(${c.id})">✕</button>` : ''}
          </td>
        </tr>`).join('')}</tbody></table></div>`;

      this.updateSelectionUI();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  toggleOrder(id, checked) {
    if (checked) this.selectedOrders.add(id);
    else this.selectedOrders.delete(id);
    this.updateSelectionUI();
  },

  toggleAll(checked) {
    const boxes = document.querySelectorAll('.order-checkbox');
    boxes.forEach(cb => {
      cb.checked = checked;
      const id = parseInt(cb.getAttribute('data-id'));
      if (checked) this.selectedOrders.add(id);
      else this.selectedOrders.delete(id);
    });
    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const btn = document.getElementById('btnBatchInvoice');
    const countSpan = document.getElementById('selectedCount');
    if (this.selectedOrders.size > 0) {
      btn.style.display = 'inline-flex';
      countSpan.textContent = this.selectedOrders.size;
    } else {
      btn.style.display = 'none';
    }
  },

  async generateBatchInvoice() {
    const ids = Array.from(this.selectedOrders);
    if (!ids.length) return;

    const ok = await confirmDialog('Facture Groupée', `Voulez-vous générer une facture regroupant ces ${ids.length} commandes ?`, { icon: '📄' });
    if (!ok) return;

    toast('🚀 Génération de la facture groupée...', 'info');
    try {
      const response = await fetch(`${API}/facture/batch/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Erreur lors de la génération');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast('📄 Facture groupée générée', 'success');
      this.selectedOrders.clear();
      this.updateSelectionUI();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async printReceipt(id) {
    try {
      const cmd = await api(`/commandes/${id}`);
      const originalLastOrder = POS.lastOrder;
      POS.lastOrder = cmd;
      POS.printLastTicket();
      POS.lastOrder = originalLastOrder;
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async generateFacture(id) {
    const ok = await confirmDialog('Générer une facture ?', 'Voulez-vous générer une facture officielle pour cette commande ?', { icon: '📄' });
    if (!ok) return;
    try {
      const res = await api(`/commandes/${id}/facturer`, { method: 'POST' });
      toast('✅ Facture générée : ' + res.numero_facture, 'success');
      this.load();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async detail(id) {
    try {
      const cmd = await api(`/commandes/${id}`);
      document.getElementById('orderDetailBody').innerHTML = `
        <div class="ticket-preview">
          <div class="ticket-header">
            <strong>${PARAMS.nom_commerce || 'RITAJ SMART POS'}</strong><br>
            <small>${PARAMS.adresse || ''} | ICE: ${PARAMS.ice || ''}</small>
          </div>
          <div class="ticket-line"><span>N°</span><span><strong>${cmd.numero}</strong></span></div>
          <div class="ticket-line"><span>Date</span><span>${new Date(cmd.date_creation).toLocaleString('fr-FR')}</span></div>
          <div class="ticket-line"><span>Caissier</span><span>${cmd.caissier_nom || '—'}</span></div>
          ${cmd.client_nom ? `<div class="ticket-line"><span>Client</span><span>${cmd.client_nom}</span></div>` : ''}
      <div class="ticket-sep"></div>
          ${(cmd.lignes || []).map(l => `<div class="ticket-line"><span>${l.nom_produit || l.produit_nom} x${l.quantite}</span><span>${(l.sous_total_ttc || l.sous_total || 0).toFixed(2)}</span></div>`).join('')}
          <div class="ticket-sep"></div>
          <div class="ticket-line"><span>Sous-total HT</span><span>${(cmd.sous_total || 0).toFixed(2)} DH</span></div>
          <div class="ticket-line"><span>TVA</span><span>${(cmd.total_tva || 0).toFixed(2)} DH</span></div>
          ${cmd.remise_montant > 0 ? `<div class="ticket-line"><span>Remise</span><span>-${cmd.remise_montant.toFixed(2)} DH</span></div>` : ''}
          <div class="ticket-sep"></div>
          <div class="ticket-line ticket-total"><span>TOTAL TTC</span><span>${(cmd.total || 0).toFixed(2)} DH</span></div>
          <div class="ticket-sep"></div>
          <div class="ticket-line"><span>Paiement</span><span>${cmd.mode_paiement === 'especes' ? '💵 Espèces' : '💳 Carte'}</span></div>
          ${cmd.monnaie_rendue > 0 ? `<div class="ticket-line"><span>Monnaie</span><span>${cmd.monnaie_rendue.toFixed(2)} DH</span></div>` : ''}
          ${cmd.points_gagnes ? `<div class="ticket-line"><span>Points</span><span>+${cmd.points_gagnes} ⭐</span></div>` : ''}
      <div class="ticket-footer">${PARAMS.ticket_footer || 'Merci de votre visite !'}</div>
        </div>`;
      document.getElementById('orderDetailModal').style.display = 'flex';
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async annuler(id) {
    const ok = await confirmDialog(
      'Annuler cette commande ?',
      'Le stock sera restauré et les points fidélité retirés. Cette action est irréversible.',
      { icon: '🗑️', confirmText: 'Annuler la commande', danger: true }
    );
    if (!ok) return;
    try {
      await api(`/commandes/${id}/annuler`, { method: 'PUT' });
      toast('✅ Commande annulée', 'success');
      this.load();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  /** Export facture PDF (conforme DGI) */
  exportPDF(id) {
    const url = `${API}/facture/${id}/pdf`;
    const w = window.open(url + `?token=${TOKEN}`, '_blank');
    if (!w) {
      // Fallback: télécharger via fetch
      fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
        .then(r => r.blob())
        .then(blob => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `facture-${id}.pdf`;
          a.click();
          URL.revokeObjectURL(a.href);
          toast('📄 Facture PDF téléchargée', 'success');
        })
        .catch(e => toast('Erreur export PDF: ' + e.message, 'error'));
    }
  },

  /** Export facture JSON */
  async exportJSON(id) {
    try {
      const data = await api(`/facture/${id}/json`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `facture-${id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('📋 Facture JSON téléchargée', 'success');
    } catch (e) { toast('Erreur export JSON: ' + e.message, 'error'); }
  }
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                     CLIENTS                               ║
// ╚═══════════════════════════════════════════════════════════╝

const CLIENTS = {
  data: [],
  async load() {
    viewLoading('clientsBody');
    try {
      this.data = await api('/clients');
      this.render();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  render(list) {
    const items = list || this.data;
    const body = document.getElementById('clientsBody');
    if (!items.length) { body.innerHTML = '<p class="text-center text-muted p-16">Aucun client</p>'; return; }
    body.innerHTML = `<div class="table-responsive"><table class="data-table">
      <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Points</th><th>Solde Crédit</th><th>Achats</th><th>Visites</th><th>Actions</th></tr></thead>
      <tbody>${items.map(c => `<tr>
        <td><strong>${c.nom}</strong></td>
        <td>${c.telephone || '—'}</td>
        <td>${c.email || '—'}</td>
        <td><strong>${c.points_fidelite}</strong> pts</td>
        <td style="color:${c.solde_credit > 0 ? 'var(--danger)' : 'var(--success)'}"><strong>${(c.solde_credit || 0).toFixed(2)} DH</strong></td>
        <td>${(c.total_achats || 0).toFixed(2)} DH</td>
        <td>${c.nb_visites || 0}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="CLIENTS.edit(${c.id})" title="Modifier">✏️</button>
          ${c.solde_credit > 0 ? `<button class="btn btn-sm btn-success" onclick="CLIENTS.settleCredit(${c.id}, '${c.nom}', ${c.solde_credit})" title="Régler Dette">💰</button>` : ''}
          <button class="btn btn-sm btn-outline" onclick="CLIENTS.exportReleve(${c.id})" title="Exporter Relevé">📄</button>
          <button class="btn btn-sm btn-info" onclick="CLIENTS.viewHistory(${c.id})" title="Historique">📜</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  },

  search(val) {
    if (!val) { this.render(); return; }
    const l = val.toLowerCase();
    this.render(this.data.filter(c => c.nom.toLowerCase().includes(l) || (c.telephone || '').includes(l)));
  },

  viewHistory(clientId) {
    APP.switchView('history');
    const input = document.getElementById('historySearch');
    window.__histClientId = clientId; // Pass client ID to filter
    HISTORY.loadWithClient(clientId);
  },

  async settleCredit(id, nom, solde) {
    const amount = await APP.prompt(`Règlement de dette : ${nom}`, `Dette actuelle : ${solde.toFixed(2)} DH. Entrez le montant payé :`, { type: 'number', defaultValue: solde });
    if (!amount || isNaN(amount) || amount <= 0) return;

    try {
      await api(`/clients/${id}/regler-credit`, { method: 'POST', body: { montant: parseFloat(amount) } });
      toast('✅ Règlement enregistré', 'success');
      this.load();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  exportReleve(id) {
    const url = `${API}/clients/${id}/releve/pdf?token=${TOKEN}`;
    window.open(url, '_blank');
  },
  async showAddCredit() {
    const id = prompt('ID du client :');
    if (!id) return;
    const montant = parseFloat(prompt('Montant du crédit (DH) :'));
    if (isNaN(montant) || montant <= 0) return toast('Montant invalide', 'error');
    try {
      await api(`/clients/${id}/credits`, {
        method: 'POST',
        body: { montant, type: 'debit', description: 'Crédit manuel' }
      });
      toast('Crédit ajouté', 'success');
      this.load();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  openForm(client = null) {
    document.getElementById('clientFormId').value = client ? client.id : '';
    document.getElementById('clientFormNom').value = client ? client.nom : '';
    document.getElementById('clientFormTel').value = client ? client.telephone || '' : '';
    document.getElementById('clientFormEmail').value = client ? client.email || '' : '';
    document.getElementById('clientFormAdresse').value = client ? client.adresse || '' : '';
    document.getElementById('clientFormNotes').value = client ? client.notes || '' : '';
    document.getElementById('clientFormTarif').value = client ? client.type_tarif || 'particulier' : 'particulier';
    document.getElementById('clientFormTitle').textContent = client ? '✏️ Modifier Client' : '👤 Nouveau Client';
    document.getElementById('clientFormModal').style.display = 'flex';
  },

  edit(id) {
    const c = this.data.find(x => x.id === id);
    if (c) this.openForm(c);
  },

  async save() {
    const id = document.getElementById('clientFormId').value;
    const body = {
      nom: document.getElementById('clientFormNom').value.trim(),
      telephone: document.getElementById('clientFormTel').value.trim(),
      email: document.getElementById('clientFormEmail').value.trim(),
      adresse: document.getElementById('clientFormAdresse').value.trim(),
      type_tarif: document.getElementById('clientFormTarif').value,
      notes: document.getElementById('clientFormNotes').value.trim()
    };
    if (!body.nom) { toast('Le nom est requis', 'error'); return; }
    try {
      if (id) {
        await api(`/clients/${id}`, { method: 'PUT', body });
        toast('✅ Client modifié', 'success');
      } else {
        const res = await api('/clients', { method: 'POST', body: { ...body, points_fidelite: 0 } });
        toast('✅ Client créé', 'success');
        // Auto-select created client if in POS flow
        if (document.getElementById('posClientSearch')) {
          POS.selectClient(res.id, body.nom, 0);
          APP.closeModal('clientSearchModal');
        }
      }
      APP.closeModal('clientFormModal');
      this.load();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  }
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                      STOCK                                ║
// ╚═══════════════════════════════════════════════════════════╝

const STOCK = {
  data: [],

  // --- Quick Inventory Logic ---
  openQuickInventory() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'inventoryModal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>⚡ Inventaire Rapide</h2>
          <button class="btn btn-icon modal-close" onclick="document.getElementById('inventoryModal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Scanner le produit</label>
            <input type="text" id="invScan" class="input-full" placeholder="Code-barres..." autofocus onkeydown="if(event.key==='Enter') STOCK.scanInventory(this.value)">
          </div>
          <div id="invResult" style="margin-top:16px; min-height:100px; display:flex; flex-direction:column; gap:8px;">
            <p class="text-muted text-center" style="margin-top:20px">En attente de scan...</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('invScan').focus(), 100);
  },

  async scanInventory(code) {
    if (!code || !code.trim()) return;
    try {
      // Try by Barcode first
      let p = await api(`/produits/code-barre/${encodeURIComponent(code)}`).catch(() => null);

      // If not found, try by ID if numeric (less common but useful)
      if (!p && /^\d+$/.test(code)) {
        // This assumes we have an endpoint or can search. Let's rely on barcode only for 'Quick' inventory
        // Or leverage local PRODUCTS list if available? Admin users might not have full list loaded in POS view.
        // Let's stick to API.
      }

      if (!p) throw new Error('Produit introuvable');

      this.showInventoryForm(p);
      document.getElementById('invScan').value = '';
    } catch (e) {
      document.getElementById('invResult').innerHTML = `<p class="text-danger text-center">❌ Produit introuvable (${code})</p>`;
      document.getElementById('invScan').select();
    }
  },

  showInventoryForm(p) {
    const container = document.getElementById('invResult');
    container.innerHTML = `
      <div class="card p-16" style="background:var(--bg-hover)">
        <h3 class="mb-4">${p.nom}</h3>
        <p class="text-muted mb-8">${p.code_barre || 'Sans code'} | Réf: ${p.id}</p>
        <div class="flex-between">
          <span style="font-size:0.9rem">Stock actuel: <strong>${p.stock_quantite}</strong></span>
        </div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>Nouveau Stock Réel</label>
        <div style="display:flex;gap:8px">
          <input type="number" id="invNewQty" class="input-full" value="${p.stock_quantite}" step="0.001" onkeydown="if(event.key==='Enter') STOCK.saveInventory(${p.id})">
          <button class="btn btn-primary" onclick="STOCK.saveInventory(${p.id})">Valider</button>
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('invNewQty').select(), 50);
  },

  async saveInventory(id) {
    const qty = parseFloat(document.getElementById('invNewQty').value);
    if (isNaN(qty)) return;
    try {
      await api('/stock/adjust', {
        method: 'POST',
        body: { produit_id: id, quantite: qty, motif: 'Inventaire Rapide', type: 'correction' }
      });
      toast('✅ Stock mis à jour', 'success');
      document.getElementById('invResult').innerHTML = '<p class="text-success text-center" style="margin-top:20px">✅ Enregistré ! Suivant...</p>';
      document.getElementById('invScan').focus();
      if (document.getElementById('stockBody').offsetParent) this.load(); // Refresh bg list
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async load() {
    viewLoading('stockBody');
    try {
      this.data = await api('/stock');
      this.render();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
          <td><button class="btn btn-sm btn-outline" onclick="STOCK.openAdjust(${s.produit_id}, '${s.produit_nom.replace(/'/g, "\\'")}', ${s.quantite})">📝 Ajuster</button></td>
        </tr>`;
    }).join('')}</tbody></table></div>`;
  },

  async showAlertes() {
    try {
      const alertes = await api('/stock/alertes');
      this.render(alertes);
      toast(`⚠️ ${alertes.length} produit(s) en alerte`, alertes.length ? 'error' : 'success');
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
      toast(`⚠️ ${alertes.length} produit(s) proche de la péremption`, 'warning');
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
    const prodId = document.getElementById('stockAdjustProdId').value;
    const qty = parseFloat(document.getElementById('stockAdjustQty').value);
    const motif = document.getElementById('stockAdjustMotif').value;
    try {
      await api(`/stock/${prodId}`, { method: 'PUT', body: { quantite: qty, motif } });
      toast('✅ Stock ajusté', 'success');
      APP.closeModal('stockAdjustModal');
      this.load();
      APP.checkStockAlerts();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  }
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                      STATS                                ║
// ╚═══════════════════════════════════════════════════════════╝

const STATS = {
  currentReport: 'synthese',
  lastData: null,

  async init() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('statsDate').value = today;
    document.getElementById('statsDateFin').value = today;

    // Load Filter Dropdowns
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

    // Visibility of date range
    const dFin = document.getElementById('statsDateFin');
    const multiDate = ['synthese', 'categories', 'utilisateurs', 'paiements', 'marges', 'audit'].includes(type);
    dFin.style.display = multiDate ? '' : 'none';

    this.load();
  },

  async load() {
    viewLoading('statsBody');
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
        url = `/stats/z?date=${dateDeb}`; // TVA breakdown from Z report
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
    const dev = PARAMS.devise || 'DH';
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
    if (!data) return toast('Aucune donnée à exporter', 'warning');

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

    const url = `${API}/stats/export/pdf?type=${type}&date_debut=${dateDeb}&date_fin=${dateFin}&utilisateur_id=${userId}&categorie_id=${catId}&token=${TOKEN}`;
    window.open(url, '_blank');
  },

  print80mm() {
    const content = document.getElementById('statsBody').innerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');

    // Thermal Optimized CSS
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
            <strong>${PARAMS.nom_commerce || 'POS'}</strong><br>
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

// ╔═══════════════════════════════════════════════════════════╗
// ║                      ADMIN                                ║
// ╚═══════════════════════════════════════════════════════════╝

// ╔═══════════════════════════════════════════════════════════╗
// ║                      CLIENTS                              ║
// ╚═══════════════════════════════════════════════════════════╝

const ADMIN = {
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
    else if (tab === 'parametres') this.loadParametres();
    else if (tab === 'backups') this.loadBackups();
  },

  // --- Produits ---
  async loadProduits() {
    viewLoading('adminBody');
    try {
      this.products = await api('/produits?all=1'); // Store globally for filtering
      this.renderProductsAdmin();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
          <button class="btn btn-primary btn-sm" onclick="ADMIN.openProduitForm()">+ Nouveau Produit</button>
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
        <td><input type="checkbox" class="label-check" value="${p.id}" data-name="${p.nom.replace(/"/g, '&quot;')}" data-price="${p.prix_ttc}" data-code="${p.code_barre || ''}"></td>
        <td><small>${p.code_barre || '—'}</small></td>
        <td><strong>${p.nom}</strong></td>
        <td><span class="badge" style="background:${p.categorie_couleur}22;color:${p.categorie_couleur}">${p.categorie_nom || '—'}</span></td>
        <td><strong>${p.prix_ttc.toFixed(2)} DH</strong></td>
        <td>${p.stock_quantite <= p.stock_seuil ? '<span class="text-danger">⚠️ ' + p.stock_quantite + '</span>' : p.stock_quantite}</td>
        <td>${p.actif ? '✅' : '❌'}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick='ADMIN.editProduit(${JSON.stringify(p).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-sm ${p.actif ? 'btn-danger' : 'btn-success'}" onclick="ADMIN.toggleProduit(${p.id}, ${p.actif})">${p.actif ? '🚫' : '✅'}</button>
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
  },

  printLabels() {
    const selected = Array.from(document.querySelectorAll('.label-check:checked')).map(c => ({
      id: c.value,
      nom: c.getAttribute('data-name'),
      prix: parseFloat(c.getAttribute('data-price')),
      code: c.getAttribute('data-code')
    }));

    if (!selected.length) { toast('Aucun produit sélectionné', 'warning'); return; }

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
            <!-- Placeholder for actual barcode rendering if library added later -->
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
    document.getElementById('produitFormCout').value = prod ? prod.cout_revient || '' : '';
    document.getElementById('produitFormBarcode').value = prod ? prod.code_barre || '' : '';
    document.getElementById('produitFormDesc').value = prod ? prod.description || '' : '';
    document.getElementById('produitFormUnite').value = prod ? prod.unite || 'piece' : 'piece';
    document.getElementById('produitFormPoids').value = prod ? prod.poids_net || '' : '';
    document.getElementById('produitFormTitle').textContent = prod ? '✏️ Modifier Produit' : '🍞 Nouveau Produit';

    // Button Create Variant
    const btnVar = document.getElementById('btnCreateVariant');
    if (prod && !prod.parent_id && btnVar) {
      btnVar.style.display = 'block';
    } else if (btnVar) {
      btnVar.style.display = 'none';
    }

    // Catégories
    try {
      const cats = await api('/categories');
      document.getElementById('produitFormCat').innerHTML = '<option value="">— Aucune —</option>' + cats.map(c => `<option value="${c.id}" ${prod && prod.categorie_id == c.id ? 'selected' : ''}>${c.icone} ${c.nom}</option>`).join('');
    } catch (e) { }

    // Taxes
    document.getElementById('produitFormTaxe').innerHTML = this.taxes.map(t => `<option value="${t.id}" ${prod && prod.taxe_id == t.id ? 'selected' : ''}>${t.nom} (${t.taux}%)</option>`).join('');

    // Set DLC
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

      // Pre-fill form as new product based on parent
      this.openProduitForm({
        ...parent,
        id: '', // New ID
        parent_id: parent.id, // Link to parent
        nom: parent.nom + ' (Var)',
        code_barre: '', // Reset barcode
        stock_quantite: 0
      });
      document.getElementById('produitFormTitle').textContent = '➕ Nouvelle Variante';
      document.getElementById('btnCreateVariant').style.display = 'none'; // Hide button on variant form
    } catch (e) { toast(e.message, 'error'); }
  },

  async editProduit(id) {
    try {
      const prods = await api(`/produits?all=1`);
      const p = prods.find(x => x.id === id);
      if (p) this.openProduitForm(p);
    } catch (e) { }
  },

  async saveProduit() {
    const id = document.getElementById('produitFormId').value;
    const parentId = document.getElementById('produitFormParentId').value;
    const nomEl = document.getElementById('produitFormNom');
    const prixEl = document.getElementById('produitFormPrix');

    // Validation
    let valid = true;
    valid &= validateField(nomEl, { required: true });
    valid &= validateField(prixEl, { required: true, min: 0 });

    if (!valid) { toast('Merci de remplir les champs obligatoires (*)', 'error'); return; }

    const body = {
      nom: nomEl.value.trim(),
      prix_ttc: parseFloat(prixEl.value),
      categorie_id: parseInt(document.getElementById('produitFormCat').value) || null,
      taxe_id: parseInt(document.getElementById('produitFormTaxe').value) || 1,
      prix_semi_gros: parseFloat(document.getElementById('produitFormPrixSemi').value) || 0,
      prix_gros: parseFloat(document.getElementById('produitFormPrixGros').value) || 0,
      cout_revient: parseFloat(document.getElementById('produitFormCout').value) || 0,
      code_barre: document.getElementById('produitFormBarcode').value.trim(),
      dlc: document.getElementById('produitFormDlc').value || null,
      description: document.getElementById('produitFormDesc').value.trim(),
      unite: document.getElementById('produitFormUnite').value,
      poids_net: parseFloat(document.getElementById('produitFormPoids').value) || 0,
      parent_id: parentId ? parseInt(parentId) : null
    };

    try {
      if (id) await api(`/produits/${id}`, { method: 'PUT', body });
      else await api('/produits', { method: 'POST', body: { ...body, stock_initial: 0 } });
      toast('✅ Produit enregistré', 'success');
      APP.closeModal('produitFormModal');
      this.loadProduits();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async toggleProduit(id, currentActif) {
    if (!currentActif) {
      // Activer direct
      try {
        const prods = await api('/produits?all=1');
        const p = prods.find(x => x.id === id);
        if (p) {
          await api(`/produits/${id}`, { method: 'PUT', body: { ...p, actif: 1 } });
          this.loadProduits();
        }
      } catch (e) { toast('Erreur: ' + e.message, 'error'); }
    } else {
      // Confirmer désactivation
      const ok = await confirmDialog('Désactiver ce produit ?', 'Il ne sera plus visible en caisse.', { icon: '🚫', danger: true });
      if (ok) {
        try {
          const prods = await api('/produits?all=1');
          const p = prods.find(x => x.id === id);
          if (p) {
            await api(`/produits/${id}`, { method: 'PUT', body: { ...p, actif: 0 } });
            this.loadProduits();
          }
        } catch (e) { toast('Erreur: ' + e.message, 'error'); }
      }
    }
  },

  // --- Catégories ---
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
             <button class="btn btn-sm btn-outline" onclick="ADMIN.editCategory(${c.id}, '${c.nom.replace(/'/g, "\\'")}', '${c.couleur}', '${c.icone}', ${c.ordre}, ${c.actif})">✏️</button>
             <button class="btn btn-sm ${c.actif ? 'btn-danger' : 'btn-success'}" onclick="ADMIN.toggleCategory(${c.id}, ${c.actif})">${c.actif ? '🚫' : '✅'}</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async addCategory() {
    const nom = await APP.prompt('Nom de la catégorie:');
    if (!nom) return;
    const icone = await APP.prompt('Icône (emoji):', '', '🍽️') || '🍽️';
    const couleur = await APP.prompt('Couleur (hex):', '', '#e67e22') || '#e67e22';
    try {
      await api('/categories', { method: 'POST', body: { nom, icone, couleur, ordre: 0 } });
      toast('✅ Catégorie créée', 'success');
      this.loadCategories();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async toggleCategory(id, currentActif) {
    if (currentActif) {
      const ok = await confirmDialog('Désactiver la catégorie ?', 'Les produits de cette catégorie seront cachés.', { danger: true });
      if (!ok) return;
    }
    try {
      await api(`/categories/${id}`, { method: 'PUT', body: { actif: currentActif ? 0 : 1 } }); // Note: API needs complete object usually, check if partial update supported or need fetch first. Assuming partial or handling in backend. Actually existing code used prompt for edit, let's fetch first to be safe.
      // Safe way: fetch all, find, update
      const cats = await api('/categories/all');
      const c = cats.find(x => x.id === id);
      if (c) {
        await api(`/categories/${id}`, { method: 'PUT', body: { ...c, actif: currentActif ? 0 : 1 } });
        this.loadCategories();
      }
    } catch (e) { toast(e.message, 'error'); }
  },

  async editCategory(id, nom, couleur, icone, ordre, actif) {
    const newNom = await APP.prompt('Nom:', '', nom); if (!newNom) return;
    const newIcone = await APP.prompt('Icône:', '', icone) || icone;
    const newCouleur = await APP.prompt('Couleur:', '', couleur) || couleur;
    const valOrdre = await APP.prompt('Ordre:', '', ordre, 'number');
    const newOrdre = parseInt(valOrdre) || 0;
    try {
      await api(`/categories/${id}`, { method: 'PUT', body: { nom: newNom, icone: newIcone, couleur: newCouleur, ordre: newOrdre, actif } });
      toast('✅ Catégorie modifiée', 'success');
      this.loadCategories();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  // --- Utilisateurs ---
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
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
      const u = users.find(x => x.id === id);
      if (u) this.openUserForm(u);
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async deleteUser(id) {
    if (!await confirmDialog('Supprimer cet utilisateur ?', 'Cette action est irréversible.', { danger: true })) return;
    try {
      await api(`/utilisateurs/${id}`, { method: 'DELETE' });
      toast('🗑️ Utilisateur supprimé', 'success');
      this.loadUsers();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  editUser(user) { this.openUserForm(user); },

  async saveUser() {
    const id = document.getElementById('userFormId').value;
    const nomEl = document.getElementById('userFormNom');
    const loginEl = document.getElementById('userFormLogin');
    const emailEl = document.getElementById('userFormEmail');

    // Validation inline
    let valid = true;
    valid &= validateField(nomEl, { required: true });
    valid &= validateField(loginEl, { required: true, minLength: 3 });
    if (emailEl.value) valid &= validateField(emailEl, { email: true });

    if (!valid) { toast('Formulaire invalide', 'error'); return; }

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

    if (!id && !pass) { toast('Mot de passe requis pour un nouvel utilisateur', 'error'); return; }

    try {
      if (id) await api(`/utilisateurs/${id}`, { method: 'PUT', body });
      else await api('/utilisateurs', { method: 'POST', body: { ...body, password: pass } });
      toast('✅ Utilisateur enregistré', 'success');
      APP.closeModal('userFormModal');
      this.loadUsers();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  // --- Remises ---
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
          <td>${r.type === 'pourcentage' ? '📊 Pourcentage' : '💰 Montant fixe'}</td>
          <td><strong>${r.type === 'pourcentage' ? r.valeur + '%' : r.valeur + ' DH'}</strong></td>
          <td>${r.condition_min ? r.condition_min + ' DH min.' : '—'}</td>
          <td>${r.date_debut && r.date_fin ? r.date_debut + ' → ' + r.date_fin : 'Permanent'}</td>
          <td class="actions">
             <button class="btn btn-sm btn-danger" onclick="ADMIN.deleteRemise(${r.id})">🗑️</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async addRemise() {
    const nom = await APP.prompt('Nom de la remise:'); if (!nom) return;
    const type = await APP.prompt('Type (pourcentage / montant):', '', 'pourcentage') || 'pourcentage';
    const valStr = await APP.prompt('Valeur:', '', '10', 'number');
    const valeur = parseFloat(valStr); if (!valeur) return;
    try {
      await api('/remises', { method: 'POST', body: { nom, type, valeur } });
      toast('✅ Remise créée', 'success');
      this.loadRemises();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async deleteRemise(id) {
    if (!await confirmDialog('Supprimer cette remise ?', 'Elle ne sera plus disponible.', { danger: true })) return;
    try {
      await api(`/remises/${id}`, { method: 'DELETE' });
      toast('✅ Remise supprimée', 'success');
      this.loadRemises();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  // --- Dépenses ---
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
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async addDepense() {
    const categorie = await APP.prompt('Catégorie', 'Matières premières, Loyer, Salaires, Fournitures, Autre:');
    if (!categorie) return;
    const valMontant = await APP.prompt('Montant (DH):', '', '', 'number');
    const montant = parseFloat(valMontant); if (!montant) return;
    const description = await APP.prompt('Description:') || '';
    try {
      await api('/depenses', { method: 'POST', body: { categorie, montant, description } });
      toast('✅ Dépense enregistrée', 'success');
      this.loadDepenses();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },
  async deleteDepense(id) {
    if (!await confirmDialog('Supprimer cette dépense ?', 'Cette action est irréversible.', { danger: true })) return;
    try {
      await api(`/depenses/${id}`, { method: 'DELETE' });
      toast('✅ Dépense supprimée', 'success');
      this.loadDepenses();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  // --- Paramètres ---
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

      // Options toggle pour ticket
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

      // NEW: Feature Toggles
      const featureOptions = [
        ['feature_fidelite', '⭐ Programme Fidélité', 'Gérer les points et récompenses'],
        ['feature_livraison', '🛵 Gestion Livraison', 'Module de livraison et livreurs'],
        // Tables & KDS removed for Retail Pivot
        ['feature_pourboire', '💰 Pourboires', 'Gestion des pourboires serveurs'],
        ['feature_dlc', '📅 Dates Péremption', 'Suivi des dates limites (DLC)'],
        ['feature_credit', '📒 Crédit Client', 'Gestion des ardoises / dettes'],
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
      <button class="btn btn-primary" onclick="ADMIN.saveParametres()">💾 Enregistrer tout</button>
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
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
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
    const body = {};
    // Champs texte/nombre
    const inputs = document.querySelectorAll('[id^="param_"]');
    inputs.forEach(i => { if (i.dataset.key) body[i.dataset.key] = i.value; });

    // Options toggles (Feature & Ticket)
    document.querySelectorAll('.ticket-option').forEach(el => {
      // ID ex: topt_ticket_show_logo or fopt_feature_fidelite
      // Key starts after the first 5 chars (topt_ or fopt_)
      const key = el.id.substring(5);
      body[key] = el.classList.contains('active') ? '1' : '0';
    });

    // Force disable Restaurant Features (Retail Pivot)
    body['feature_tables'] = '0';
    body['feature_kds'] = '0';

    try {
      await api('/parametres', { method: 'PUT', body });
      PARAMS = await api('/parametres');
      toast('✅ Paramètres enregistrés', 'success');
      // Reload to apply potential feature changes
      setTimeout(() => location.reload(), 500);
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  previewTicket() {
    // Génère un ticket de démo pour prévisualiser
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
    // Sauvegarde temporaire, imprimer, et restaurer
    const prev = POS.lastOrder;
    POS.lastOrder = demoOrder;

    // Récupérer les valeurs actuelles des toggles avant d'imprimer
    const tempParams = { ...PARAMS };
    document.querySelectorAll('[id^="topt_"]').forEach(el => {
      const key = el.id.replace('topt_', '');
      tempParams[key] = el.classList.contains('active') ? '1' : '0';
    });
    const paramInputs = document.querySelectorAll('[id^="param_"]');
    paramInputs.forEach(i => { if (i.dataset.key) tempParams[i.dataset.key] = i.value; });
    const prevParams = PARAMS;
    PARAMS = tempParams;

    POS.printLastTicket();

    POS.lastOrder = prev;
    PARAMS = prevParams;
  },

  // --- Backups (DGI) ---
  async loadBackups() {
    viewLoading('adminBody');
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
    } catch (e) { toast('Erreur charge backups: ' + e.message, 'error'); }
  },

  async createBackup() {
    try {
      if (!await confirmDialog('Créer un backup ?', 'Cela peut prendre quelques secondes.')) return;
      await api('/backup', { method: 'POST' });
      toast('✅ Backup créé', 'success');
      this.loadBackups();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  async createArchive() {
    try {
      if (!await confirmDialog('Générer Archive Légale ?', 'Cette opération gèle les données et signe les fichiers.', { icon: '⚖️' })) return;
      viewLoading('adminBody');
      await api('/backup/archive', { method: 'POST' });
      toast('✅ Archive DGI générée', 'success');
      this.loadBackups();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); this.loadBackups(); }
  },

  async verifyBackup(filename) {
    try {
      const res = await api('/backup/verify', { method: 'POST', body: { filename } });
      if (res.valid) toast('✅ Backup intègre (SHA256 validé)', 'success');
      else toast('❌ Backup corrompu !', 'error');
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  downloadBackup(filename) {
    // Open in new tab with token
    window.open(`${API}/backup/download/${filename}?token=${TOKEN}`, '_blank');
  },

  async resetDatabase() {
    const mode = document.getElementById('resetMode').value;
    const confirmCode = await APP.prompt(`⚠️ ACTION IRRÉVERSIBLE ⚠️`, `Pour confirmer la suppression de TOUTES les données et le passage en mode ${mode.toUpperCase()}, écrivez "RESET-DANGER" ci-dessous :`);
    if (confirmCode !== 'RESET-DANGER') return toast('Annulé : Code de confirmation incorrect', 'info');

    const doubleCheck = await confirmDialog('Êtes-vous ABSOLUMENT sûr ?', 'Toutes les données commerciales seront perdues.', { danger: true, confirmText: 'OUI, TOUT EFFACER' });
    if (!doubleCheck) return;

    viewLoading('adminBody');
    try {
      await api('/admin/reset-database', { method: 'POST', body: { mode, confirmation: 'RESET-DANGER' } });
      alert('✅ Base de données réinitialisée avec succès !\n\nL\'application va maintenant se recharger avec le nouveau profil métier.');
      window.location.reload();
    } catch (e) {
      toast('Erreur: ' + e.message, 'error');
      this.loadParametres();
    }
  },


};

// ╔═══════════════════════════════════════════════════════════╗
// ║                   SETUP WIZARD                            ║
// ╚═══════════════════════════════════════════════════════════╝
const SETUP = {
  currentStep: 1,
  selectedProfile: null,
  profiles: [],

  async start() {
    // Cacher tout sauf le wizard
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('setupWizard').style.display = 'flex';

    // Charger les profils depuis l'API
    try {
      this.profiles = await fetch(`${API}/setup/profiles`).then(r => r.json());
      SETUP_PROFILES = this.profiles;
    } catch (e) {
      toast('Erreur chargement des profils: ' + e.message, 'error');
      return;
    }

    this.renderProfiles();
    this.goToStep(1);
  },

  renderProfiles() {
    const grid = document.getElementById('profilesGrid');
    if (!grid) return;

    grid.innerHTML = this.profiles.map(p => `
      <div class="profile-card" style="--profile-color:${p.couleur_primaire}" onclick="SETUP.selectProfile('${p.id}')" data-profile="${p.id}">
        <div class="profile-check">✓</div>
        <div class="profile-icon">${p.icone}</div>
        <div class="profile-name">${p.nom}</div>
        <div class="profile-desc">${p.description}</div>
        <div class="profile-stats">
          <span class="profile-stat">📂 ${p.nb_categories} catégories</span>
          <span class="profile-stat">📦 ${p.nb_produits} produits</span>
        </div>
        <div class="profile-features">
          ${p.features.sur_place ? '<span class="profile-feature">🏠 Sur place</span>' : ''}
          ${p.features.emporter ? '<span class="profile-feature">🛍️ Emporter</span>' : ''}
          ${p.features.livraison ? '<span class="profile-feature">🚗 Livraison</span>' : ''}
          ${p.features.tables ? '<span class="profile-feature">🍽️ Tables</span>' : ''}
          ${p.features.kds ? '<span class="profile-feature">📺 KDS</span>' : ''}
          ${p.features.code_barres ? '<span class="profile-feature">📊 Code-barres</span>' : ''}
          ${p.features.fidelite ? '<span class="profile-feature">⭐ Fidélité</span>' : ''}
        </div>
      </div>
    `).join('');
  },

  selectProfile(profileId) {
    this.selectedProfile = this.profiles.find(p => p.id === profileId);
    document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.profile-card[data-profile="${profileId}"]`);
    if (card) card.classList.add('selected');

    // Passer automatiquement à l'étape 2 après un court délai
    setTimeout(() => this.goToStep(2), 400);
  },

  goToStep(step) {
    // Validation avant de passer à l'étape suivante
    if (step === 2 && !this.selectedProfile) {
      toast('Veuillez sélectionner un type de commerce', 'error');
      return;
    }
    if (step === 3) {
      // Valider les champs obligatoires de l'étape 2
      const nom = document.getElementById('setupCommerceName').value.trim();
      const login = document.getElementById('setupAdminLogin').value.trim();
      const pass = document.getElementById('setupAdminPassword').value;
      if (!nom) { toast('Le nom du commerce est requis', 'error'); document.getElementById('setupCommerceName').focus(); return; }
      if (!login) { toast('L\'identifiant admin est requis', 'error'); document.getElementById('setupAdminLogin').focus(); return; }
      if (!pass || pass.length < 4) { toast('Le mot de passe doit contenir au moins 4 caractères', 'error'); document.getElementById('setupAdminPassword').focus(); return; }

      // Construire le récapitulatif
      this.renderSummary();
    }

    this.currentStep = step;

    // Mettre à jour les indicateurs d'étape
    document.querySelectorAll('.wizard-step').forEach(s => {
      const sNum = parseInt(s.dataset.step);
      s.classList.remove('active', 'done');
      if (sNum === step) s.classList.add('active');
      else if (sNum < step) s.classList.add('done');
    });
    document.querySelectorAll('.wizard-step-line').forEach((line, idx) => {
      line.classList.toggle('done', idx < step - 1);
    });

    // Afficher le bon panel
    document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`wizardStep${step}`);
    if (panel) panel.classList.add('active');
  },

  renderSummary() {
    const prof = this.selectedProfile;
    const commerce = {
      nom: document.getElementById('setupCommerceName').value.trim(),
      adresse: document.getElementById('setupCommerceAddress').value.trim(),
      ville: document.getElementById('setupCommerceCity').value.trim(),
      telephone: document.getElementById('setupCommercePhone').value.trim(),
      ice: document.getElementById('setupCommerceICE').value.trim(),
    };
    const admin = {
      nom: document.getElementById('setupAdminName').value.trim(),
      login: document.getElementById('setupAdminLogin').value.trim(),
    };

    const summary = document.getElementById('wizardSummary');
    summary.innerHTML = `
      <div class="summary-card">
        <h4>${prof.icone} Type de Commerce</h4>
        <div class="summary-item"><span class="label">Profil</span><span class="value">${prof.nom}</span></div>
        <div class="summary-item"><span class="label">Catégories</span><span class="value">${prof.nb_categories}</span></div>
        <div class="summary-item"><span class="label">Produits</span><span class="value">${prof.nb_produits}</span></div>
        <div class="summary-item"><span class="label">Types commande</span><span class="value">${prof.types_commande.join(', ')}</span></div>
      </div>
      <div class="summary-card">
        <h4>🏪 Votre Commerce</h4>
        <div class="summary-item"><span class="label">Nom</span><span class="value">${commerce.nom || '—'}</span></div>
        <div class="summary-item"><span class="label">Adresse</span><span class="value">${commerce.adresse || '—'}</span></div>
        <div class="summary-item"><span class="label">Ville</span><span class="value">${commerce.ville || '—'}</span></div>
        <div class="summary-item"><span class="label">Téléphone</span><span class="value">${commerce.telephone || '—'}</span></div>
        <div class="summary-item"><span class="label">ICE</span><span class="value">${commerce.ice || '—'}</span></div>
      </div>
      <div class="summary-card">
        <h4>🔐 Compte Admin</h4>
        <div class="summary-item"><span class="label">Nom</span><span class="value">${admin.nom || '—'}</span></div>
        <div class="summary-item"><span class="label">Login</span><span class="value">${admin.login}</span></div>
        <div class="summary-item"><span class="label">Mot de passe</span><span class="value">••••••</span></div>
      </div>
      <div class="summary-card">
        <h4>✨ Fonctionnalités</h4>
        ${Object.entries(prof.features).filter(([, v]) => v).map(([k]) => {
      const labels = { tables: '🍽️ Gestion de tables', kds: '📺 Kitchen Display', code_barres: '📊 Code-barres', livraison: '🚗 Livraison', emporter: '🛍️ À emporter', sur_place: '🏠 Sur place', fidelite: '⭐ Fidélité', pourboire: '💰 Pourboire' };
      return `<div class="summary-item"><span class="value">${labels[k] || k}</span></div>`;
    }).join('')}
      </div>
    `;
  },

  async complete() {
    const btn = document.getElementById('setupCompleteBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Configuration en cours...';

    // Afficher l'écran de progression
    document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('wizardStepProgress').style.display = 'block';
    document.getElementById('wizardStepProgress').classList.add('active');

    const progressBar = document.getElementById('setupProgressBar');
    const progressText = document.getElementById('setupProgressText');

    try {
      progressBar.style.width = '20%';
      progressText.textContent = 'Création du profil et de la base de données...';
      await new Promise(r => setTimeout(r, 500));

      progressBar.style.width = '40%';
      progressText.textContent = 'Insertion des catégories et produits...';

      const result = await fetch(`${API}/setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: this.selectedProfile.id,
          commerce: {
            nom: document.getElementById('setupCommerceName').value.trim(),
            adresse: document.getElementById('setupCommerceAddress').value.trim(),
            ville: document.getElementById('setupCommerceCity').value.trim(),
            telephone: document.getElementById('setupCommercePhone').value.trim(),
            ice: document.getElementById('setupCommerceICE').value.trim(),
          },
          admin: {
            nom: document.getElementById('setupAdminName').value.trim(),
            prenom: document.getElementById('setupAdminPrenom').value.trim(),
            login: document.getElementById('setupAdminLogin').value.trim(),
            password: document.getElementById('setupAdminPassword').value,
          }
        })
      }).then(r => r.json());

      if (result.error) throw new Error(result.error);

      progressBar.style.width = '70%';
      progressText.textContent = 'Configuration des paramètres...';
      await new Promise(r => setTimeout(r, 500));

      progressBar.style.width = '90%';
      progressText.textContent = 'Finalisation...';
      await new Promise(r => setTimeout(r, 400));

      // Sauvegarder le token et l'utilisateur
      TOKEN = result.token;
      USER = result.user;
      localStorage.setItem('pos_token', TOKEN);
      localStorage.setItem('pos_user', JSON.stringify(USER));

      progressBar.style.width = '100%';
      progressText.textContent = '✅ Configuration terminée !';
      await new Promise(r => setTimeout(r, 800));

      // Lancer l'application
      APP.showApp();
      toast(`🎉 Bienvenue ! Votre ${this.selectedProfile.nom} est prêt !`, 'success');

    } catch (err) {
      progressText.textContent = '❌ Erreur: ' + err.message;
      progressBar.style.width = '0%';
      progressBar.style.background = 'var(--danger)';
      btn.disabled = false;
      btn.textContent = '🚀 Réessayer';
      // Revenir à l'étape 3 après un délai
      setTimeout(() => {
        document.getElementById('wizardStepProgress').style.display = 'none';
        this.goToStep(3);
      }, 3000);
    }
  }
};


// ╔═══════════════════════════════════════════════════════════╗
// ║                 DASHBOARD (Accueil)                       ║
// ╚═══════════════════════════════════════════════════════════╝

const DASHBOARD = {
  show() {
    document.getElementById('dashboardScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    // Mise à jour du nom utilisateur
    const nameEl = document.getElementById('dashUserName');
    if (nameEl && USER) {
      nameEl.textContent = `${USER.prenom || ''} ${USER.nom}`.trim();
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


const LIVRAISON = {
  data: [],

  async load() {
    viewLoading('livraisonBody');
    try {
      const statut = document.getElementById('livraisonStatut').value;
      const query = statut ? `?statut=${statut}` : '';
      this.data = await api('/livraisons' + query);
      this.render();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },

  render() {
    const body = document.getElementById('livraisonBody');
    if (!body) return;

    if (!this.data.length) {
      body.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">Aucune livraison</div>';
      return;
    }

    body.innerHTML = `<div class="table-responsive"><table class="data-table">
      <thead><tr><th>Commande</th><th>Adresse</th><th>Zone</th><th>Tel</th><th>Frais</th><th>Total</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>
        ${this.data.map(l => `<tr>
          <td>${l.commande_numero || '-'}</td>
          <td>${l.adresse || '-'}</td>
          <td>${l.zone || '-'}</td>
          <td>${l.telephone || '-'}</td>
          <td>${l.frais_livraison?.toFixed(2) || '0.00'} DH</td>
          <td>${((l.commande_total || 0) + (l.frais_livraison || 0)).toFixed(2)} DH</td>
          <td><span class="badge badge-${l.statut === 'livree' ? 'success' : l.statut === 'en_cours' ? 'warning' : 'info'}">${l.statut}</span></td>
          <td class="actions">
            <button class="btn btn-sm btn-outline" onclick="LIVRAISON.updateStatut(${l.id}, 'en_cours')">🚗 En cours</button>
            <button class="btn btn-sm btn-success" onclick="LIVRAISON.updateStatut(${l.id}, 'livree')">✓ Livrée</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  },

  async updateStatut(id, statut) {
    try {
      await api(`/livraisons/${id}/statut`, { method: 'PUT', body: { statut } });
      toast('Statut mis à jour', 'success');
      this.load();
    } catch (e) { toast('Erreur: ' + e.message, 'error'); }
  },
};

// ═══════════════════ KEYBOARD SHORTCUTS ═══════════════════
document.addEventListener('keydown', (e) => {
  if (!USER) return;
  // F2: Focus recherche
  if (e.key === 'F2') { e.preventDefault(); document.getElementById('searchInput')?.focus(); }
  // F4: Espèces
  if (e.key === 'F4') { e.preventDefault(); POS.pay('especes'); }
  // F5: Carte
  if (e.key === 'F5') { e.preventDefault(); POS.pay('carte'); }
  // F8: Vider panier
  if (e.key === 'F8') { e.preventDefault(); POS.clearCart(); }
  // Escape: Fermer modals + confirm dialogs
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    document.querySelectorAll('.confirm-overlay').forEach(m => m.remove());
    document.getElementById('userDropdown').style.display = 'none';
  }
  // ?: Afficher raccourcis clavier
  if (e.key === '?' && !e.target.matches('input, textarea, select')) {
    e.preventDefault();
    showShortcutsModal();
  }
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) {
    document.getElementById('userDropdown') && (document.getElementById('userDropdown').style.display = 'none');
  }
});

// ═══════════════════ DÉMARRAGE ═══════════════════
document.addEventListener('DOMContentLoaded', () => APP.init());
