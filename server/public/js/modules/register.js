import { api } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';

export const RegisterModule = {
    registerStatus: 'fermee',

    async checkRegisterStatus() {
        try {
            const res = await api('/caisse/statut');
            this.registerStatus = res.statut;
            if (res.statut === 'fermee') this.showOpenRegisterModal();
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
            UI.toast('✅ Caisse ouverte avec succès', 'success');
            document.getElementById('openRegisterModal').style.display = 'none';
            this.registerStatus = 'ouverte';
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
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
        } catch (e) { UI.toast('Erreur charge cloture: ' + e.message, 'error'); }
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
        if (!await UI.confirmDialog('Clôturer la caisse ?', "Cette action est irréversible. Assurez-vous d'avoir compté le fond de caisse.")) return;
        const montant_reel = parseFloat(document.getElementById('closeRegReal').value) || 0;
        const notes = document.getElementById('closeRegNotes').value;
        try {
            await api('/caisse/fermer', { method: 'POST', body: { montant_reel, notes } });
            UI.toast('✅ Caisse clôturée', 'success');
            document.getElementById('closeRegisterModal').style.display = 'none';
            this.registerStatus = 'fermee';
            if (await UI.confirmDialog('Imprimer Z ?', 'Voulez-vous imprimer le rapport de clôture ?')) {
                await this.printZReport();
            }
            setTimeout(() => window.location.reload(), 2000);
        } catch (e) { UI.toast('Erreur: ' + e.message, 'error'); }
    },

    openCashMovementModal() {
        document.getElementById('cashMvtAmount').value = '';
        document.getElementById('cashMvtReason').value = '';
        document.getElementById('cashMovementModal').style.display = 'flex';
        setTimeout(() => document.getElementById('cashMvtAmount').focus(), 100);
    },

    async saveCashMovement() {
        const btn = document.getElementById('btnSaveCashMvt');
        const type = document.getElementById('cashMvtType').value;
        const montant = parseFloat(document.getElementById('cashMvtAmount').value);
        const motif = document.getElementById('cashMvtReason').value;
        const linkExpense = document.getElementById('linkToExpense') ? document.getElementById('linkToExpense').checked : false;
        if (!montant || montant <= 0) return UI.toast('Montant invalide', 'warning');
        if (btn) UI.btnLoading(btn, true);
        try {
            await api('/caisse/mouvements', { method: 'POST', body: { type, montant, motif, link_expense: linkExpense } });
            UI.toast('✅ Mouvement enregistré', 'success');
            if (window.APP) APP.closeModal('cashMovementModal');
        } catch (e) {
            UI.toast('Erreur: ' + e.message, 'error');
        } finally {
            if (btn) UI.btnLoading(btn, false);
        }
    },
};
