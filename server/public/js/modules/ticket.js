import { state } from '../core/state.js';

export const TicketModule = {
    printLastTicket() {
        if (!this.lastOrder) return;
        const o = this.lastOrder;
        const P = state.params;
        const on = (key) => P[key] !== '0';
        const devise = P.devise || 'DH';
        const fontSize = parseInt(P.ticket_font_size) || 13;
        const largeur = parseInt(P.ticket_largeur) || 300;

        let articlesHtml = '';
        if (on('ticket_show_articles') && o.lignes && o.lignes.length) {
            articlesHtml = `
        <div class="sep"></div>
        <div class="line header-row"><span class="col-name">ARTICLE</span><span class="col-qty">QTÉ</span><span class="col-price">MONTANT</span></div>
        <div class="sep"></div>`;
            o.lignes.forEach(l => {
                const qtyLabel = l.quantite < 0 ? `(RETOUR) x${Math.abs(l.quantite)}` : `x${l.quantite}`;
                articlesHtml += `<div class="article-row">
          <div class="line"><span class="col-name bold">${l.nom_produit}</span><span class="col-qty">${qtyLabel}</span><span class="col-price bold">${(l.sous_total_ttc || 0).toFixed(2)}</span></div>
          ${on('ticket_show_tva_detail') ? `<div class="tva-detail">  P.U: ${(l.prix_unitaire_ttc || 0).toFixed(2)} ${devise} | TVA ${l.taux_tva || 0}%</div>` : ''}
        </div>`;
            });
        }

        const isRefund = o.total < 0;
        const receiptLabel = o.numero_facture ? 'FACTURE' : (isRefund ? 'REÇU DE REMBOURSEMENT' : 'REÇU DE VENTE');

        const w = window.open('', '_blank', 'width=380,height=700');
        w.document.write(`<html><head><title>Ticket — ${o.numero}</title><style>
      @page { margin: 2mm; size: ${largeur}px auto; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Consolas', 'Courier New', 'Lucida Console', monospace; font-size: ${fontSize}px; font-weight: 600; line-height: 1.5; padding: 8px; max-width: ${largeur}px; margin: 0 auto; color: #000; -webkit-print-color-adjust: exact; }
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
      .col-qty { width: 60px; text-align: center; }
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
      <div class="center bold" style="font-size: ${fontSize + 2}px; margin-bottom: 8px;">${receiptLabel}</div>

      ${on('ticket_show_numero') ? `<div class="line"><span>N° Commande:</span><span class="bold">${o.numero}</span></div>` : ''}
      ${o.numero_facture ? `<div class="line"><span>N° Facture:</span><span class="bold">${o.numero_facture}</span></div>` : ''}
      ${on('ticket_show_date_heure') ? `<div class="line"><span>${new Date().toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}</span><span>${new Date().toLocaleTimeString('fr-FR')}</span></div>` : ''}
      ${on('ticket_show_caissier') && o.caissier_nom ? `<div class="line"><span>Caissier:</span><span class="bold">${o.caissier_nom}</span></div>` : ''}
      ${on('ticket_show_client') && o.client_nom ? `<div class="line"><span>Client:</span><span class="bold">${o.client_nom}</span></div>` : ''}
      ${on('ticket_show_type_cmd') ? `<div class="line"><span>Cmd:</span><span>${o.type_commande === 'emporter' ? '🛍️ Emporter' : o.type_commande === 'livraison' ? '🚗 Livraison' : '🏠 Sur place'}</span></div>` : ''}

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

      ${on('ticket_show_mode_paiement') ? `<div class="line bold"><span>${isRefund ? 'Remboursé en' : 'Paiement'}</span><span>${o.mode_paiement === 'especes' ? '💵 Espèces' : '💳 Carte'}</span></div>` : ''}
      ${on('ticket_show_monnaie') && o.montant_recu > 0 ? `<div class="line"><span>Reçu</span><span>${o.montant_recu.toFixed(2)} ${devise}</span></div>` : ''}
      ${on('ticket_show_monnaie') && o.monnaie_rendue > 0 ? `<div class="line bold"><span>Monnaie</span><span>${o.monnaie_rendue.toFixed(2)} ${devise}</span></div>` : ''}
      ${on('ticket_show_points') && o.points_gagnes ? `<div class="line"><span>⭐ Points fidélité</span><span>${o.points_gagnes > 0 ? '+' : ''}${o.points_gagnes}</span></div>` : ''}

      <div class="sep"></div>
      ${on('ticket_show_footer') ? `<div class="center footer bold">${P.ticket_footer || 'Merci de votre visite ! 🍞'}</div>` : ''}
      ${P.ticket_message_promo ? `<div class="promo">${P.ticket_message_promo}</div>` : ''}

    </body></html>`);
        w.document.close();
        setTimeout(() => { w.print(); w.close(); }, 400);
    },

    async printZReport() {
        try {
            const zData = await (await import('../core/api.js')).api('/stats/z');
            const dateStr = new Date().toLocaleString();
            const fmt = (n) => (n || 0).toFixed(2);
            const html = `<html><head><title>Z-REPORT</title><style>body{font-family:monospace;width:300px;margin:0 auto;font-size:12px}.center{text-align:center}.bold{font-weight:bold}hr{border:1px dashed #000}.row{display:flex;justify-content:space-between}</style></head><body>
            <div class="center"><h3>RAPPORT Z (CLÔTURE)</h3><p>${dateStr}</p><p>Caissier: ${import('../core/state.js').then ? '' : ''}</p></div>
            <hr>
            <div class="row"><span>Ventes Brut:</span><span>${fmt(zData.sales.brut)}</span></div>
            <div class="row"><span>Retours:</span><span>${fmt(zData.sales.retours.montant)}</span></div>
            <div class="row bold"><span>Ventes Net:</span><span>${fmt(zData.sales.net)}</span></div>
            <div class="row"><span>Nb Commandes:</span><span>${zData.sales.nb_commandes}</span></div>
            <div class="row"><span>Panier Moyen:</span><span>${fmt(zData.sales.panier_moyen)}</span></div>
            <hr><div class="center bold">ENCAISSEMENTS</div>
            ${zData.payments.map(p => `<div class="row"><span>${p.mode_paiement.toUpperCase()}:</span><span>${fmt(p.montant)}</span></div>`).join('')}
            <hr><div class="center bold">CAISSE (ESPÈCES)</div>
            <div class="row"><span>Fond Initial:</span><span>${fmt(zData.caisse.fond_initial)}</span></div>
            <div class="row"><span>+ Espèces:</span><span>${fmt(zData.caisse.ventes_especes)}</span></div>
            <div class="row"><span>+ Dépôts:</span><span>${fmt(zData.caisse.depots)}</span></div>
            <div class="row"><span>- Retraits:</span><span>${fmt(zData.caisse.retraits)}</span></div>
            <div class="row bold"><span>= THÉORIQUE:</span><span>${fmt(zData.caisse.theorique)}</span></div>
            ${zData.caisse.reel ? `<div class="row"><span>= RÉEL:</span><span>${fmt(zData.caisse.reel)}</span></div>` : ''}
            ${zData.caisse.ecart ? `<div class="row"><span>= ÉCART:</span><span>${fmt(zData.caisse.ecart)}</span></div>` : ''}
            <hr><div class="center">*** FIN RAPPORT ***</div><br><br></body></html>`;
            const win = window.open('', 'PrintZ', 'width=400,height=600');
            win.document.write(html); win.document.close();
            setTimeout(() => { win.print(); win.close(); }, 500);
        } catch (e) {
            const { default: UI } = await import('../core/ui.js');
            UI.toast('Erreur impression Z: ' + e.message, 'error');
        }
    },

    async printXReport() {
        try {
            const zData = await (await import('../core/api.js')).api('/stats/z');
            const dateStr = new Date().toLocaleString();
            const fmt = (n) => (n || 0).toFixed(2);
            const html = `<html><head><title>X-REPORT</title><style>body{font-family:monospace;width:300px;margin:0 auto;font-size:12px}.center{text-align:center}.bold{font-weight:bold}hr{border:1px dashed #000}.row{display:flex;justify-content:space-between}</style></head><body>
            <div class="center"><h3>RAPPORT X (FLASH)</h3><p>(PROVISOIRE - NON CLÔTURÉ)</p><p>${dateStr}</p></div>
            <hr>
            <div class="row"><span>Ventes Brut:</span><span>${fmt(zData.sales.brut)}</span></div>
            <div class="row bold"><span>Ventes Net:</span><span>${fmt(zData.sales.net)}</span></div>
            <div class="row"><span>Nb Commandes:</span><span>${zData.sales.nb_commandes}</span></div>
            <hr><div class="center bold">ENCAISSEMENTS</div>
            ${zData.payments.map(p => `<div class="row"><span>${p.mode_paiement.toUpperCase()}:</span><span>${fmt(p.montant)}</span></div>`).join('')}
            <hr><div class="center bold">CAISSE (ESPÈCES)</div>
            <div class="row bold"><span>= THÉORIQUE:</span><span>${fmt(zData.caisse.theorique)}</span></div>
            <hr><div class="center">*** FIN RAPPORT X ***</div><br><br></body></html>`;
            const win = window.open('', 'PrintX', 'width=400,height=600');
            win.document.write(html); win.document.close();
            setTimeout(() => { win.print(); win.close(); }, 500);
        } catch (e) {
            const { default: UI } = await import('../core/ui.js');
            UI.toast('Erreur impression X: ' + e.message, 'error');
        }
    },
};
