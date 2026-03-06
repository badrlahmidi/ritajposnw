/** Notification Toast */
export function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.borderLeftColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)';
    el.style.borderLeftWidth = '4px';
    el.style.borderLeftStyle = 'solid';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

/** Confirmation dialog (remplace window.confirm) */
export function confirmDialog(title, message, { icon = '⚠️', confirmText = 'Confirmer', cancelText = 'Annuler', danger = false } = {}) {
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

/** Prompt dialog (remplace window.prompt) */
export function promptDialog(title, defaultValue = '') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
          <div class="confirm-box" style="min-width:300px">
             <div class="confirm-title">${title}</div>
             <input type="text" id="promptInput" value="${defaultValue}" style="width:100%;padding:10px;margin:15px 0;font-size:16px;border:1px solid #ccc;border-radius:4px;outline:none" />
             <div class="confirm-actions">
                <button class="btn btn-outline" id="promptCancel">Annuler</button>
                <button class="btn btn-primary" id="promptOk">Valider</button>
             </div>
          </div>`;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#promptInput');
        input.focus();
        if (defaultValue) input.select();

        overlay.querySelector('#promptOk').onclick = () => { overlay.remove(); resolve(input.value); };
        overlay.querySelector('#promptCancel').onclick = () => { overlay.remove(); resolve(null); };
        input.onkeydown = e => {
            if (e.key === 'Enter') { overlay.remove(); resolve(input.value); }
            if (e.key === 'Escape') { overlay.remove(); resolve(null); }
        };
        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    });
}

/** Loading state pour un bouton */
export function btnLoading(btn, loading = true, text = '') {
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
export function viewLoading(containerId, loading = true) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (loading) {
        el.innerHTML = `<div class="view-loading"><span class="spinner spinner-lg"></span> Chargement...</div>`;
    }
}

/** Wrapper table responsive */
export function wrapTablesResponsive(html) {
    return html.replace(/<table class="data-table"/g, '<div class="table-responsive"><table class="data-table"')
        .replace(/<\/table>/g, '</table></div>');
}

/** Validation inline pour un champ */
export function validateField(input, rules = {}) {
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

/** Formater la monnaie */
export function formatMoney(amount) {
    const devise = (window.PARAMS && window.PARAMS.monnaie) || 'DH';
    return parseFloat(amount || 0).toFixed(2) + ' ' + devise;
}

/** Formater la date */
export function formatDate(dateStr, time = false) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
