// js/event-handlers.js
// Central event delegation — replaces all inline HTML event handlers.
// Loaded as type="module" after app.js so window.POS, window.APP, etc. are available.

document.addEventListener('DOMContentLoaded', () => {

  // ─── Coerce a data-* string to boolean or number where appropriate ───────
  function coerce(v) {
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v !== '' && !isNaN(v)) return Number(v);
    return v;
  }

  // ─── Close modal-overlay: data-close-overlay ─────────────────────────────
  // Removes the nearest .modal-overlay ancestor of the clicked element.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-close-overlay]');
    if (!btn) return;
    const overlay = btn.closest('.modal-overlay');
    if (overlay) overlay.remove();
  });

  // ─── Click delegation: data-action [data-num | data-param[2[3]]] ─────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    // Self-only: only fire when the element itself (not a child) is clicked
    if ('selfOnly' in el.dataset && e.target !== el) return;

    const [ns, fn] = el.dataset.action.split('.');
    const mod = window[ns];
    if (!mod || typeof mod[fn] !== 'function') return;

    // Multi-param via JSON array (data-params)
    if ('params' in el.dataset) {
      try { mod[fn](...JSON.parse(el.dataset.params)); } catch (err) { console.error('data-params parse error', err); }
      return;
    }

    // Numeric single arg (needs actual Number, e.g. SETUP.goToStep, POS.pmFastCash)
    if ('num' in el.dataset) { mod[fn](Number(el.dataset.num)); return; }

    // Three string/coerced params
    if ('param3' in el.dataset) {
      mod[fn](el.dataset.param, coerce(el.dataset.param2), coerce(el.dataset.param3));
      return;
    }

    // Two params: first stays string, second is coerced (handles booleans & numbers)
    if ('param2' in el.dataset) { mod[fn](el.dataset.param, coerce(el.dataset.param2)); return; }

    // Single string param
    if ('param' in el.dataset) { mod[fn](el.dataset.param); return; }

    mod[fn]();
  });

  // ─── Click with full event: data-click-event-action ──────────────────────
  // Used when the handler needs the MouseEvent (e.g. to disable the button).
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-click-event-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.clickEventAction.split('.');
    const mod = window[ns];
    if (mod && typeof mod[fn] === 'function') mod[fn](e);
  });

  // ─── Input delegation: data-input-action → fn(el.value) ──────────────────
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.inputAction.split('.');
    const mod = window[ns];
    if (mod && typeof mod[fn] === 'function') mod[fn](el.value);
  });

  // ─── Change delegation: data-change-action → fn(el.value) ────────────────
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.changeAction.split('.');
    const mod = window[ns];
    if (mod && typeof mod[fn] === 'function') mod[fn](el.value);
  });

  // ─── Change with full event: data-change-event-action → fn(event) ────────
  // Used for file inputs where the handler reads event.target.files.
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change-event-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.changeEventAction.split('.');
    const mod = window[ns];
    if (mod && typeof mod[fn] === 'function') mod[fn](e);
  });

  // ─── Change with param: data-change-param-action → fn(data-param, el.value) ─
  // Used when an index/id (fixed) plus the new value are both needed.
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change-param-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.changeParamAction.split('.');
    const mod = window[ns];
    if (mod && typeof mod[fn] === 'function') mod[fn](el.dataset.param, el.value);
  });

  // ─── Change with checkbox: data-change-check-action → fn([param,] checked) ─
  // Used for checkbox onchange handlers that pass this.checked.
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change-check-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.changeCheckAction.split('.');
    const mod = window[ns];
    if (!mod || typeof mod[fn] !== 'function') return;
    if ('param' in el.dataset) mod[fn](el.dataset.param, el.checked);
    else mod[fn](el.checked);
  });

  // ─── Keydown Enter: data-keydown-enter-action → fn() ────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const el = e.target.closest('[data-keydown-enter-action]');
    if (!el) return;
    const [ns, fn] = el.dataset.keydownEnterAction.split('.');
    const mod = window[ns];
    if (mod && typeof mod[fn] === 'function') mod[fn]();
  });

  // ─── Login form submit ────────────────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (window.APP) APP.login(e);
    });
  }

  // ─── Fast cash images: press/release scale animation ─────────────────────
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('fast-cash-img')) e.target.style.transform = 'scale(0.93)';
  });
  document.addEventListener('mouseup', (e) => {
    if (e.target.classList.contains('fast-cash-img')) e.target.style.transform = 'scale(1)';
  });

  // ─── Search input keydown (needs event + value) ───────────────────────────
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (window.POS) POS.handleSearchKey(e, searchInput.value);
    });
  }

  // ─── Phone input: digits only ─────────────────────────────────────────────
  const deliveryPhone = document.getElementById('deliveryPhone');
  if (deliveryPhone) {
    deliveryPhone.addEventListener('input', () => {
      deliveryPhone.value = deliveryPhone.value.replace(/[^0-9]/g, '');
    });
  }

  // ─── Stock alert dismiss ──────────────────────────────────────────────────
  const btnDismissStockAlert = document.getElementById('btnDismissStockAlert');
  if (btnDismissStockAlert) {
    btnDismissStockAlert.addEventListener('click', () => {
      const el = document.getElementById('stockAlert');
      if (el) el.style.display = 'none';
    });
  }

  // ─── Prompt input clear ───────────────────────────────────────────────────
  const btnClearPromptInput = document.getElementById('btnClearPromptInput');
  if (btnClearPromptInput) {
    btnClearPromptInput.addEventListener('click', () => {
      const inp = document.getElementById('promptInput');
      if (inp) { inp.value = ''; inp.focus(); }
    });
  }

  // ─── Create variant button ────────────────────────────────────────────────
  const btnCreateVariant = document.getElementById('btnCreateVariant');
  if (btnCreateVariant) {
    btnCreateVariant.addEventListener('click', () => {
      if (window.ADMIN) ADMIN.createVariant(document.getElementById('produitFormId').value);
    });
  }

  // ─── Cash movement type → show/hide expense link group ───────────────────
  const cashMvtType = document.getElementById('cashMvtType');
  if (cashMvtType) {
    cashMvtType.addEventListener('change', () => {
      const eg = document.getElementById('expenseLinkGroup');
      if (eg) eg.style.display = cashMvtType.value === 'retrait' ? 'block' : 'none';
    });
  }

  // ─── Mixte payment inputs → update rest ──────────────────────────────────
  ['pmMixteEspeces', 'pmMixteCarte'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { if (window.POS) POS.updateMixteRest(); });
  });

  // ─── Close register: calculate diff on input ─────────────────────────────
  const closeRegReal = document.getElementById('closeRegReal');
  if (closeRegReal) {
    closeRegReal.addEventListener('input', () => { if (window.POS) POS.calcCloseDiff(); });
  }

});
