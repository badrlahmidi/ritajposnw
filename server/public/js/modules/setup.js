import { api, API } from '../core/api.js';
import { state } from '../core/state.js';
import * as UI from '../core/ui.js';
import { APP } from '../core/app.js';

let SETUP_PROFILES = [];

export const SETUP = {
    currentStep: 1,
    selectedProfile: null,
    profiles: [],

    async start() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('dashboardScreen').style.display = 'none';
        const wizard = document.getElementById('setupWizard');
        if (wizard) wizard.style.display = 'flex';

        try {
            this.profiles = await fetch(`${API}/setup/profiles`).then(r => r.json());
            SETUP_PROFILES = this.profiles;
        } catch (e) {
            UI.toast('Erreur chargement des profils: ' + e.message, 'error');
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

        setTimeout(() => this.goToStep(2), 400);
    },

    goToStep(step) {
        if (step === 2 && !this.selectedProfile) {
            UI.toast('Veuillez sélectionner un type de commerce', 'error');
            return;
        }
        if (step === 3) {
            const nom = document.getElementById('setupCommerceName').value.trim();
            const login = document.getElementById('setupAdminLogin').value.trim();
            const pass = document.getElementById('setupAdminPassword').value;
            if (!nom) { UI.toast('Le nom du commerce est requis', 'error'); document.getElementById('setupCommerceName').focus(); return; }
            if (!login) { UI.toast('L\'identifiant admin est requis', 'error'); document.getElementById('setupAdminLogin').focus(); return; }
            if (!pass || pass.length < 4) { UI.toast('Le mot de passe doit contenir au moins 4 caractères', 'error'); document.getElementById('setupAdminPassword').focus(); return; }

            this.renderSummary();
        }

        this.currentStep = step;

        document.querySelectorAll('.wizard-step').forEach(s => {
            const sNum = parseInt(s.dataset.step);
            s.classList.remove('active', 'done');
            if (sNum === step) s.classList.add('active');
            else if (sNum < step) s.classList.add('done');
        });
        document.querySelectorAll('.wizard-step-line').forEach((line, idx) => {
            line.classList.toggle('done', idx < step - 1);
        });

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

            state.token = result.token;
            state.user = result.user;
            localStorage.setItem('pos_token', state.token);
            localStorage.setItem('pos_user', JSON.stringify(state.user));

            progressBar.style.width = '100%';
            progressText.textContent = '✅ Configuration terminée !';
            await new Promise(r => setTimeout(r, 800));

            APP.showApp();
            UI.toast(`🎉 Bienvenue ! Votre ${this.selectedProfile.nom} est prêt !`, 'success');

        } catch (err) {
            progressText.textContent = '❌ Erreur: ' + err.message;
            progressBar.style.width = '0%';
            progressBar.style.background = 'var(--danger)';
            btn.disabled = false;
            btn.textContent = '🚀 Réessayer';
            setTimeout(() => {
                document.getElementById('wizardStepProgress').style.display = 'none';
                this.goToStep(3);
            }, 3000);
        }
    }
};

// Make sure SETUP is globally available for inline onclicks if needed
window.SETUP = SETUP;
