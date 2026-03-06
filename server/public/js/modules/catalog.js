import { api } from '../core/api.js';
import { beepScan, beepError } from '../core/sounds.js';
import * as UI from '../core/ui.js';

export const CatalogModule = {
    categories: [],
    produits: [],
    currentCategory: 'all',

    async loadCategories() {
        try { this.categories = await api('/categories'); } catch (e) { console.error(e); }
    },

    async loadProducts() {
        try {
            let url;
            if (this.currentCategory === 'all' || this.currentCategory === 'favorites') {
                url = '/produits';
            } else {
                url = `/produits?categorie_id=${this.currentCategory}`;
            }
            this.produits = await api(url);
        } catch (e) { console.error(e); }
    },

    renderCategories() {
        const bar = document.getElementById('categoriesBar');
        let html = `<button class="cat-btn ${this.currentCategory === 'all' ? 'active' : ''}" onclick="POS.selectCategory('all')"><span class="cat-icon">📋</span><span class="cat-name">Tout</span></button>`;
        html += `<button class="cat-btn ${this.currentCategory === 'favorites' ? 'active' : ''}" onclick="POS.selectCategory('favorites')"><span class="cat-icon">⭐</span><span class="cat-name">Favoris</span></button>`;
        for (const c of this.categories) {
            const isActive = this.currentCategory == c.id;
            let bgStyle = '';
            if (c.image) {
                bgStyle = `background: url('uploads/${c.image}') center/cover no-repeat;`;
            } else {
                bgStyle = isActive ? `background:${c.couleur};border-color:${c.couleur};color:#fff;` : '';
            }
            html += `<button class="cat-btn ${isActive ? 'active' : ''} ${c.image ? 'has-image' : ''}" onclick="POS.selectCategory(${c.id})"
        style="${bgStyle}">
        ${!c.image ? `<span class="cat-icon">${c.icone}</span>` : ''}
        <span class="cat-name" style="${c.image ? 'background:rgba(0,0,0,0.6);color:#fff;width:100%;bottom:0;position:absolute;padding:4px 0;' : ''}">${c.nom}</span>
        </button>`;
        }
        bar.innerHTML = html;
    },

    async selectCategory(id) {
        this.currentCategory = id;
        await this.loadProducts();
        this.renderCategories();
        this.renderProducts();
    },

    renderProducts(filter = '') {
        const grid = document.getElementById('productsGrid');
        let items = this.produits;
        if (this.currentCategory === 'favorites') {
            const favs = this.getFavorites();
            items = items.filter(p => p.est_favori || favs[p.id])
                .sort((a, b) => {
                    if (a.est_favori && !b.est_favori) return -1;
                    if (!a.est_favori && b.est_favori) return 1;
                    return (favs[b.id] || 0) - (favs[a.id] || 0);
                });
        }
        if (filter) { const l = filter.toLowerCase(); items = items.filter(p => p.nom.toLowerCase().includes(l)); }
        if (!items.length) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">🔍</div><p>Aucun produit trouvé</p></div>`;
            return;
        }
        grid.innerHTML = items.map(p => {
            const stockClass = p.stock_quantite <= p.stock_seuil ? 'low' : '';
            const imageStyle = p.image ? `background-image: url('uploads/${p.image}');` : '';
            const stockBadge = p.stock_quantite <= 0
                ? '<span class="stock-badge out">Rupture</span>'
                : `<span class="stock-badge in-stock ${stockClass}">${p.stock_quantite}</span>`;
            return `
            <div class="product-card" onclick="POS.addToCart(${p.id})" style="--cat-color:${p.categorie_couleur || '#e67e22'}">
                <div class="product-img" style="${imageStyle}">
                    ${!p.image ? `<span class="no-img-icon">📦</span>` : ''}
                    ${stockBadge}
                </div>
                <div class="product-details">
                    <div class="product-name" title="${p.nom}">${p.nom}</div>
                    <div class="product-price-row">
                        <span class="product-price">${p.prix_ttc.toFixed(2)} DH</span>
                    </div>
                </div>
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

    async scanBarcode(code) {
        if (!code || !code.trim()) return;
        const cleanCode = code.trim();
        const clearInput = () => {
            const el = document.getElementById('searchInput');
            if (el) { el.value = ''; el.focus(); }
            this.searchProducts('');
        };
        // Balance weight barcode (prefix 21-28, 13 digits)
        if (/^2[0-9]{12}$/.test(cleanCode)) {
            const itemCode = cleanCode.substring(2, 7);
            const valueRaw = cleanCode.substring(7, 12);
            const value = parseInt(valueRaw) / 1000;
            try {
                const produits = await api(`/produits?search=${encodeURIComponent(itemCode)}`);
                const p = produits.find(x => x.code_barre === itemCode || x.id == parseInt(itemCode));
                if (p) {
                    this.addToCart(p.id, p, value);
                    beepScan();
                    UI.toast(`✅ ${p.nom} : ${value.toFixed(3)}kg ajouté`, 'success');
                    clearInput();
                    return;
                }
            } catch (e) { console.error(e); }
        }
        try {
            const produit = await api(`/produits/code-barre/${encodeURIComponent(cleanCode)}`);
            this.addToCart(produit.id, produit);
            beepScan();
            UI.toast(`✅ ${produit.nom} ajouté`, 'success');
        } catch (e) {
            beepError();
            UI.toast(`❌ Code-barres "${cleanCode}" non trouvé`, 'error');
        }
        clearInput();
    },

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

        const strictFavs = this.produits.filter(p => p.est_favori);
        const autoFavs = this.getFavorites();
        let displayList = [...strictFavs];

        const sortedAuto = Object.entries(autoFavs)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => this.produits.find(x => x.id === parseInt(id)))
            .filter(p => p && !p.est_favori);

        displayList = [...displayList, ...sortedAuto].slice(0, 10);

        if (displayList.length === 0) { bar.style.display = 'none'; return; }

        bar.style.display = 'flex';
        items.innerHTML = displayList.map(p => {
            const label = p.est_favori ? '⭐ ' + p.nom : p.nom;
            return `<button class="btn btn-sm ${p.est_favori ? 'btn-warning' : 'btn-outline'}" onclick="POS.addToCart(${p.id})" style="white-space:nowrap;font-size:0.75rem;padding:4px 8px;font-weight:600" title="${p.nom}">${label.substring(0, 18)} · ${p.prix_ttc}DH</button>`;
        }).join('');
    },
};
