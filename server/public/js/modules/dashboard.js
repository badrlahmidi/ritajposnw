import { APP } from '../core/app.js';
import { state } from '../core/state.js'; // To access user info if needed
import { ADMIN } from './admin.js';

export const DASHBOARD = {
    show() {
        document.getElementById('dashboardScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        // Mise à jour du nom utilisateur
        const nameEl = document.getElementById('dashUserName');
        if (nameEl && state.user) {
            nameEl.textContent = `${state.user.prenom || ''} ${state.user.nom}`.trim();
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
