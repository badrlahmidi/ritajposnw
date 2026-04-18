/**
 * ═════════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — i18n scaffolding (core/i18n.js)
 *  ---------------------------------------------------------------
 *  Minimal, dependency-free translation layer.
 *
 *  - Default locale: 'fr' (the app ships in French, keys fall through).
 *  - Additional dicts can be registered via registerLocale(code, dict).
 *  - Active locale is read from localStorage('pos_locale') or <html lang>.
 *  - `dir="rtl"` is applied automatically when an RTL locale is active
 *    (ar/he/fa/ur).
 *
 *  Usage from JS:
 *      import { t, setLocale } from '../core/i18n.js';
 *      UI.toast(t('cart.cleared'));
 *
 *  Usage from HTML (via event-handlers auto-translate on load):
 *      <span data-i18n="nav.pos">Caisse</span>
 *
 *  Keeping this tiny on purpose — a full translation audit of every
 *  string can be rolled out incrementally without breaking the app.
 * ═════════════════════════════════════════════════════════════════
 */

const RTL_LOCALES = new Set(['ar', 'ar-MA', 'he', 'fa', 'ur']);

const DICTS = {
    fr: {
        // Seed with keys already used by JS modules — kept small for now.
        'cart.cleared': 'Ticket vidé',
        'cart.undo': '↩️ Annuler',
        'action.confirm': 'Confirmer',
        'action.cancel': 'Annuler',
        'action.save': 'Enregistrer',
        'action.close': 'Fermer',
        'offline.label': '🔌 Hors-ligne',
        'online.label': '🟢 En ligne',
    },
};

let currentLocale = 'fr';

export function registerLocale(code, dict) {
    DICTS[code] = Object.assign({}, DICTS[code] || {}, dict || {});
}

export function setLocale(code) {
    if (!code) return;
    currentLocale = code;
    try { localStorage.setItem('pos_locale', code); } catch (e) { }
    const html = document.documentElement;
    html.setAttribute('lang', code);
    html.setAttribute('dir', RTL_LOCALES.has(code) ? 'rtl' : 'ltr');
    // Re-translate any static nodes marked with [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val && val !== key) el.textContent = val;
    });
}

export function getLocale() { return currentLocale; }

export function t(key, vars) {
    const dict = DICTS[currentLocale] || {};
    let str = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (vars && typeof vars === 'object') {
        str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
    }
    return str;
}

// Bootstrap on import — honour saved preference, else <html lang>, else 'fr'.
try {
    const saved = localStorage.getItem('pos_locale');
    const htmlLang = document.documentElement.getAttribute('lang');
    setLocale(saved || htmlLang || 'fr');
} catch (e) {
    setLocale('fr');
}

// Expose globally for quick use from inline scripts / templates.
window.t = t;
window.I18N = { t, setLocale, getLocale, registerLocale };
