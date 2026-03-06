import { state, clearAuth, API } from './state.js';
export { API }; // Re-export API for other modules
import { toast } from './ui.js';

export async function api(endpoint, options = {}) {
    const token = state.token;
    const isFormData = (options.body instanceof FormData) ||
        (options.body && typeof options.body === 'object' && options.body.constructor && options.body.constructor.name === 'FormData');

    const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    if (!isFormData && options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
    }

    const opts = {
        ...options,
        headers: { ...headers, ...options.headers }
    };

    if (!isFormData && opts.body && typeof opts.body === 'object') {
        opts.body = JSON.stringify(opts.body);
    }

    // Check connectivity for mutations
    const isMutation = ['POST', 'PUT', 'DELETE'].includes(opts.method || 'GET');
    if (!navigator.onLine) {
        if (isMutation) {
            queueRequest(endpoint, options);
            return { offline: true };
        } else {
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
            if (res.status === 401) {
                clearAuth();
                window.location.reload(); // Simple logout
                throw new Error('Session expirée');
            }
            if (data.details && Array.isArray(data.details)) {
                console.error('Validation Errors:', data.details);
                const detailedMsg = data.details.map(d => `${d.champ}: ${d.message}`).join(' | ');
                throw new Error('Données invalides : ' + detailedMsg);
            }
            throw new Error(data.error || 'Erreur serveur');
        }

        if (!isMutation && (endpoint.includes('/produits') || endpoint.includes('/categories') || endpoint.includes('/parametres') || endpoint.includes('/clients') || endpoint.includes('/taxes'))) {
            try {
                localStorage.setItem('pos_cache_' + endpoint, JSON.stringify(data));
            } catch (e) { console.warn('Cache full', e); }
        }

        return data;
    } catch (err) {
        if (err.message.match(/Failed to fetch|NetworkError/i)) {
            if (isMutation) {
                queueRequest(endpoint, options);
                return { offline: true };
            } else {
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
    state.offlineQueue.push({ endpoint, options, timestamp: Date.now() });
    localStorage.setItem('pos_offline_queue', JSON.stringify(state.offlineQueue));
    toast('📡 Mode Hors-ligne: Requête sauvegardée', 'warning');
}
