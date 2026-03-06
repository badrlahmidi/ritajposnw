/**
 * RITAJ SMART POS — Module de génération de factures PDF
 * Conformité DGI Maroc 2026
 */

const PDFDocument = require('pdfkit');
const crypto = require('crypto');

// ═══════════════════ HASH D'INTÉGRITÉ ═══════════════════

/**
 * Génère un hash SHA-256 d'intégrité pour une commande/facture
 * @param {Object} commande - Objet commande avec numero, date_creation, total, ice
 * @returns {string} Hash SHA-256 en hexadécimal
 */
function generateHash(commande, ice) {
  const data = [
    commande.numero || '',
    commande.date_creation || '',
    String(commande.total || 0),
    ice || ''
  ].join('|');
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ═══════════════════ NUMÉRO FACTURE ═══════════════════

/**
 * Génère un numéro de facture à partir du numéro de commande
 * CMD-20260211-0001 → FA-20260211-0001
 * @param {string} numeroCMD - Numéro de commande
 * @returns {string} Numéro de facture
 */
function genererNumeroFacture(numeroCMD) {
  if (!numeroCMD) return '';
  return numeroCMD.replace(/^CMD-/, 'FA-');
}

/**
 * Génère un numéro d'avoir à partir du numéro de commande
 * CMD-20260211-0001 → AV-20260211-0001
 */
function genererNumeroAvoir(numeroCMD) {
  if (!numeroCMD) return '';
  return numeroCMD.replace(/^CMD-/, 'AV-');
}

// ═══════════════════ GÉNÉRATION PDF ═══════════════════

/**
 * Génère une facture PDF conforme DGI
 * @param {Object} options
 * @param {Object} options.commande - Données de la commande
 * @param {Array}  options.lignes - Lignes de la commande
 * @param {Object} options.params - Paramètres du commerce
 * @param {Object} options.client - Données du client (optionnel)
 * @returns {PDFDocument} Stream PDF
 */
function genererFacturePDF({ commande, lignes, params, client }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    info: {
      Title: `Facture ${commande.numero_facture || genererNumeroFacture(commande.numero)}`,
      Author: params.raison_sociale || params.nom_commerce || 'RITAJ SMART POS',
      Subject: 'Facture',
      Creator: 'RITAJ SMART POS'
    }
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const devise = params.devise || 'DH';
  const numeroFacture = commande.numero_facture || genererNumeroFacture(commande.numero);

  // ─── Fonctions utilitaires ───
  const fmt = (n) => parseFloat(n || 0).toFixed(2);
  const fmtPrice = (n) => `${fmt(n)} ${devise}`;

  let y = doc.y;

  // ═══════════════════ EN-TÊTE VENDEUR ═══════════════════

  doc.fontSize(16).font('Helvetica-Bold')
    .text(params.raison_sociale || params.nom_commerce || 'Mon Commerce', { align: 'left' });

  doc.fontSize(9).font('Helvetica').fillColor('#555');

  if (params.adresse) doc.text(params.adresse);
  if (params.telephone) doc.text(`Tél: ${params.telephone}`);

  // Identifiants fiscaux
  const fiscalLines = [];
  if (params.ice) fiscalLines.push(`ICE: ${params.ice}`);
  if (params.identifiant_fiscal) fiscalLines.push(`IF: ${params.identifiant_fiscal}`);
  if (params.registre_commerce) fiscalLines.push(`RC: ${params.registre_commerce}`);
  if (params.numero_patente) fiscalLines.push(`Patente: ${params.numero_patente}`);
  if (params.cnss) fiscalLines.push(`CNSS: ${params.cnss}`);

  if (fiscalLines.length > 0) {
    doc.text(fiscalLines.join(' | '));
  }

  doc.moveDown(1);

  // ═══════════════════ LIGNE DE SÉPARATION ═══════════════════

  function drawLine() {
    doc.strokeColor('#ddd').lineWidth(0.5)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.5);
  }

  drawLine();

  // ═══════════════════ TITRE FACTURE ═══════════════════

  // Déterminer le type de reçu dynamiquement
  let hasPositive = false;
  let hasNegative = false;
  lignes.forEach(l => {
    if (l.quantite > 0) hasPositive = true;
    if (l.quantite < 0) hasNegative = true;
  });

  let receiptTitle = `FACTURE N° ${numeroFacture}`;
  if (hasNegative && !hasPositive) receiptTitle = `REÇU DE REMBOURSEMENT N° ${numeroFacture}`;
  if (hasNegative && hasPositive) receiptTitle = `REÇU D'ÉCHANGE N° ${numeroFacture}`;

  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold')
    .text(receiptTitle, { align: 'center' });
  doc.moveDown(0.3);

  // Date et heure
  const dateObj = new Date(commande.date_creation);
  const dateStr = dateObj.toLocaleDateString('fr-MA', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const heureStr = dateObj.toLocaleTimeString('fr-MA', {
    hour: '2-digit', minute: '2-digit'
  });

  doc.fontSize(9).font('Helvetica').fillColor('#555');
  doc.text(`Date: ${dateStr} à ${heureStr}`, { align: 'center' });

  if (commande.type_commande) {
    const types = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };
    doc.text(`Type: ${types[commande.type_commande] || commande.type_commande}`, { align: 'center' });
  }

  doc.moveDown(0.5);

  // ═══════════════════ INFO CLIENT ═══════════════════

  if (client && (client.nom || client.ice)) {
    doc.fillColor('#000').fontSize(10).font('Helvetica-Bold').text('Client :');
    doc.fontSize(9).font('Helvetica').fillColor('#555');
    if (client.nom) doc.text(client.nom);
    if (client.adresse) doc.text(client.adresse);
    if (client.telephone) doc.text(`Tél: ${client.telephone}`);
    if (client.ice) doc.text(`ICE: ${client.ice}`);
    doc.moveDown(0.5);
  } else if (commande.client_nom) {
    doc.fillColor('#000').fontSize(9).font('Helvetica')
      .text(`Client: ${commande.client_nom}`);
    doc.moveDown(0.3);
  }

  drawLine();

  // ═══════════════════ TABLEAU DES ARTICLES ═══════════════════

  const colWidths = {
    num: 25,
    designation: pageWidth - 25 - 40 - 65 - 50 - 70 - 70,
    qte: 40,
    puHT: 65,
    tva: 50,
    totalHT: 70,
    totalTTC: 70
  };

  // En-tête tableau
  y = doc.y;
  doc.fillColor('#f5f5f5').rect(doc.page.margins.left, y - 2, pageWidth, 16).fill();

  doc.fillColor('#333').fontSize(8).font('Helvetica-Bold');
  let x = doc.page.margins.left;
  doc.text('#', x, y, { width: colWidths.num, align: 'center' });
  x += colWidths.num;
  doc.text('Désignation', x, y, { width: colWidths.designation });
  x += colWidths.designation;
  doc.text('Qté', x, y, { width: colWidths.qte, align: 'center' });
  x += colWidths.qte;
  doc.text('PU HT', x, y, { width: colWidths.puHT, align: 'right' });
  x += colWidths.puHT;
  doc.text('TVA%', x, y, { width: colWidths.tva, align: 'center' });
  x += colWidths.tva;
  doc.text('Total HT', x, y, { width: colWidths.totalHT, align: 'right' });
  x += colWidths.totalHT;
  doc.text('Total TTC', x, y, { width: colWidths.totalTTC, align: 'right' });

  doc.moveDown(1);

  // Lignes du tableau
  doc.font('Helvetica').fontSize(8).fillColor('#000');

  lignes.forEach((ligne, index) => {
    y = doc.y;
    // Vérifier saut de page
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = doc.y;
    }

    // Alternance couleur
    if (index % 2 === 0) {
      doc.fillColor('#fafafa').rect(doc.page.margins.left, y - 1, pageWidth, 14).fill();
    }

    doc.fillColor('#000');
    x = doc.page.margins.left;
    doc.text(String(index + 1), x, y, { width: colWidths.num, align: 'center' });
    x += colWidths.num;
    doc.text(ligne.nom_produit || '', x, y, { width: colWidths.designation });
    x += colWidths.designation;
    const qtyText = ligne.quantite < 0 ? `(RETOUR) x ${Math.abs(ligne.quantite)}` : `x ${ligne.quantite}`;
    doc.text(qtyText, x, y, { width: colWidths.qte, align: 'center' });
    x += colWidths.qte;
    doc.text(fmt(ligne.prix_unitaire_ht), x, y, { width: colWidths.puHT, align: 'right' });
    x += colWidths.puHT;
    doc.text(`${fmt(ligne.taux_tva)}%`, x, y, { width: colWidths.tva, align: 'center' });
    x += colWidths.tva;
    doc.text(fmt(ligne.sous_total_ht), x, y, { width: colWidths.totalHT, align: 'right' });
    x += colWidths.totalHT;
    doc.text(fmt(ligne.sous_total_ttc), x, y, { width: colWidths.totalTTC, align: 'right' });

    doc.moveDown(0.5);
  });

  drawLine();

  // ═══════════════════ TOTAUX ═══════════════════

  const rightX = doc.page.margins.left + pageWidth - 200;

  function totalLine(label, value, bold) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
    doc.fillColor(bold ? '#000' : '#555');
    doc.text(label, rightX, doc.y, { width: 120, align: 'right', continued: true });
    doc.text('  ' + fmtPrice(value), { width: 80, align: 'right' });
  }

  // Sous-total HT
  const totalHT = lignes.reduce((sum, l) => sum + (parseFloat(l.sous_total_ht) || 0), 0);
  totalLine('Sous-total HT :', totalHT);

  // Ventilation TVA par taux
  const tvaMap = {};
  lignes.forEach(l => {
    const taux = parseFloat(l.taux_tva) || 0;
    if (taux > 0) {
      if (!tvaMap[taux]) tvaMap[taux] = { base: 0, montant: 0 };
      tvaMap[taux].base += parseFloat(l.sous_total_ht) || 0;
      tvaMap[taux].montant += parseFloat(l.montant_tva) || 0;
    }
  });

  Object.keys(tvaMap).sort((a, b) => a - b).forEach(taux => {
    totalLine(`TVA ${taux}% :`, tvaMap[taux].montant);
  });

  // Total TVA
  totalLine('Total TVA :', commande.total_tva || 0);

  // Remise
  if (commande.remise_montant && parseFloat(commande.remise_montant) > 0) {
    totalLine('Remise :', -parseFloat(commande.remise_montant));
  }

  doc.moveDown(0.3);

  // Total TTC
  totalLine('TOTAL TTC :', commande.total, true);

  doc.moveDown(0.5);

  // ═══════════════════ PAIEMENT ═══════════════════

  drawLine();

  const modes = {
    especes: 'Espèces', carte: 'Carte bancaire', cheque: 'Chèque',
    virement: 'Virement', mixte: 'Mixte', credit: 'Crédit'
  };

  const isRefund = (commande.total || 0) < 0;
  const paymentPrefix = isRefund ? 'Remboursé en' : 'Mode de paiement';

  doc.fontSize(9).font('Helvetica').fillColor('#555');
  doc.text(`${paymentPrefix} : ${modes[commande.mode_paiement] || commande.mode_paiement || 'Non précisé'}`);

  if (commande.mode_paiement === 'especes' && commande.montant_recu && !isRefund) {
    doc.text(`Montant reçu : ${fmtPrice(commande.montant_recu)}    Monnaie rendue : ${fmtPrice(commande.monnaie_rendue)}`);
  }

  doc.moveDown(1);

  // ═══════════════════ HASH D'INTÉGRITÉ ═══════════════════

  const hash = commande.hash_integrite || generateHash(commande, params.ice);

  doc.fontSize(7).font('Helvetica').fillColor('#999');
  doc.text(`Intégrité: SHA-256:${hash.substring(0, 32)}...`, { align: 'center' });

  // ═══════════════════ PIED DE PAGE ═══════════════════

  doc.moveDown(1);
  drawLine();

  doc.fontSize(8).font('Helvetica').fillColor('#888');
  doc.text('Document généré par RITAJ SMART POS — Facture conforme DGI Maroc', { align: 'center' });
  doc.text(`Réf. commande: ${commande.numero}`, { align: 'center' });

  return doc;
}

// ═══════════════════ EXPORT JSON STRUCTURÉ ═══════════════════

/**
 * Génère une représentation JSON structurée de la facture (préparation XML DGI)
 */
function genererFactureJSON({ commande, lignes, params, client }) {
  const hash = commande.hash_integrite || generateHash(commande, params.ice);
  const numeroFacture = commande.numero_facture || genererNumeroFacture(commande.numero);

  // Ventilation TVA
  const tvaMap = {};
  lignes.forEach(l => {
    const taux = parseFloat(l.taux_tva) || 0;
    if (!tvaMap[taux]) tvaMap[taux] = { base: 0, montant: 0 };
    tvaMap[taux].base += parseFloat(l.sous_total_ht) || 0;
    tvaMap[taux].montant += parseFloat(l.montant_tva) || 0;
  });

  return {
    facture: {
      numero: numeroFacture,
      reference_commande: commande.numero,
      date: commande.date_creation,
      statut: commande.statut,
      vendeur: {
        raison_sociale: params.raison_sociale || params.nom_commerce || '',
        adresse: params.adresse || '',
        telephone: params.telephone || '',
        ice: params.ice || '',
        identifiant_fiscal: params.identifiant_fiscal || '',
        registre_commerce: params.registre_commerce || '',
        numero_patente: params.numero_patente || '',
        cnss: params.cnss || ''
      },
      acheteur: client ? {
        nom: client.nom || commande.client_nom || '',
        telephone: client.telephone || '',
        adresse: client.adresse || '',
        ice: client.ice || ''
      } : {
        nom: commande.client_nom || 'Client comptoir'
      },
      lignes: lignes.map((l, i) => ({
        numero: i + 1,
        designation: l.nom_produit,
        quantite: l.quantite,
        prix_unitaire_ht: parseFloat(l.prix_unitaire_ht),
        taux_tva: parseFloat(l.taux_tva),
        montant_tva: parseFloat(l.montant_tva),
        total_ht: parseFloat(l.sous_total_ht),
        total_ttc: parseFloat(l.sous_total_ttc)
      })),
      totaux: {
        total_ht: lignes.reduce((sum, l) => sum + (parseFloat(l.sous_total_ht) || 0), 0),
        ventilation_tva: Object.entries(tvaMap).map(([taux, data]) => ({
          taux: parseFloat(taux),
          base: Math.round(data.base * 100) / 100,
          montant: Math.round(data.montant * 100) / 100
        })),
        total_tva: parseFloat(commande.total_tva) || 0,
        remise: parseFloat(commande.remise_montant) || 0,
        total_ttc: parseFloat(commande.total) || 0
      },
      paiement: {
        mode: commande.mode_paiement || '',
        montant_recu: parseFloat(commande.montant_recu) || 0,
        monnaie_rendue: parseFloat(commande.monnaie_rendue) || 0
      },
      hash_integrite: `sha256:${hash}`,
      type_commande: commande.type_commande || 'sur_place'
    }
  };
}

/**
 * Génère une facture regroupant plusieurs commandes
 */
function genererFactureBatchPDF({ commandes, lignes, params, client }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
  const devise = params.devise || 'DH';
  const fmt = (n) => parseFloat(n || 0).toFixed(2);

  // En-tête (Same as single facture)
  doc.fontSize(16).font('Helvetica-Bold').text(params.raison_sociale || params.nom_commerce || 'Mon Commerce', { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#555');
  if (params.adresse) doc.text(params.adresse);
  if (params.telephone) doc.text(`Tél: ${params.telephone}`);

  doc.moveDown();
  doc.fontSize(14).fillColor('#000').text(`FACTURE RÉCAPITULATIVE`, { underline: true });
  doc.fontSize(10).text(`Date de génération : ${new Date().toLocaleDateString('fr-FR')}`);

  if (client) {
    doc.moveDown();
    doc.fontSize(11).font('Helvetica-Bold').text('CLIENT :');
    doc.font('Helvetica').text(client.nom);
    if (client.adresse) doc.text(client.adresse);
    if (client.telephone) doc.text(`Tél: ${client.telephone}`);
  }

  doc.moveDown(2);
  // Table Header
  const tableTop = doc.y;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Date', 50, tableTop);
  doc.text('N° Commande', 120, tableTop);
  doc.text('Désignation', 220, tableTop);
  doc.text('Qté', 400, tableTop, { width: 40, align: 'right' });
  doc.text('Total TTC', 470, tableTop, { width: 75, align: 'right' });

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  let y = tableTop + 25;
  let totalGlobal = 0;

  commandes.forEach(cmd => {
    const cmdLignes = lignes.filter(l => l.commande_id === cmd.id);
    cmdLignes.forEach((l, i) => {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.fontSize(9).font('Helvetica');
      if (i === 0) {
        doc.text(new Date(cmd.date_creation).toLocaleDateString('fr-FR'), 50, y);
        doc.text(cmd.numero, 120, y);
      }
      doc.text(l.produit_nom, 220, y, { width: 170 });
      doc.text(l.quantite.toString(), 400, y, { width: 40, align: 'right' });
      doc.text(fmt(l.sous_total_ttc), 470, y, { width: 75, align: 'right' });
      y += 15;
    });
    totalGlobal += cmd.total;
    y += 5; // Separator between orders
    doc.moveTo(220, y - 2).lineTo(550, y - 2).dash(2, { space: 2 }).stroke().undash();
    y += 10;
  });

  doc.moveDown();
  doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL GÉNÉRAL : ${fmt(totalGlobal)} ${devise}`, { align: 'right' });

  return doc;
}

/**
 * Génère un relevé de compte client
 */
function genererReleveClientPDF({ client, operations, params }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
  const devise = params.devise || 'DH';
  const fmt = (n) => parseFloat(n || 0).toFixed(2);

  doc.fontSize(16).font('Helvetica-Bold').text('RELEVÉ DE COMPTE CLIENT', { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).font('Helvetica-Bold').text(`Client : ${client.nom}`);
  doc.font('Helvetica').text(`Solde actuel : ${fmt(client.solde_credit)} ${devise}`);
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`);

  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Date', 50, doc.y, { continued: true });
  doc.text('Description', 150, doc.y, { continued: true });
  doc.text('Débit', 350, doc.y, { continued: true, align: 'right' });
  doc.text('Crédit', 450, doc.y, { align: 'right' });
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

  let y = doc.y + 10;
  operations.forEach(op => {
    doc.fontSize(9).font('Helvetica');
    doc.text(new Date(op.date_operation).toLocaleDateString('fr-FR'), 50, y);
    doc.text(op.description || (op.type === 'debit' ? 'Achat' : 'Règlement'), 150, y, { width: 180 });
    if (op.type === 'debit') doc.text(fmt(op.montant), 350, y, { width: 80, align: 'right' });
    else doc.text(fmt(op.montant), 450, y, { width: 80, align: 'right' });
    y += 20;
    if (y > 750) { doc.addPage(); y = 50; }
  });

  return doc;
}

/**
 * Génère un rapport professionnel A4 (Tableau + Cartes)
 */
function genererRapportPDF({ title, columns, data, summary, params }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
  const devise = params.devise || 'DH';
  const fmt = (n) => typeof n === 'number' ? n.toFixed(2) : (n || '');

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(params.raison_sociale || params.nom_commerce || 'Mon Commerce', { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#555');
  if (params.adresse) doc.text(params.adresse);
  if (params.telephone) doc.text(`Tél: ${params.telephone}`);
  doc.moveDown();

  doc.fontSize(18).fillColor('#000').text(title.toUpperCase(), { align: 'center' });
  doc.fontSize(10).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });
  doc.moveDown(2);

  // Summary Cards (optional)
  if (summary && summary.length) {
    let startX = 50;
    summary.forEach(item => {
      doc.rect(startX, doc.y, 110, 45).fill('#f8f9fa').stroke('#ddd');
      doc.fillColor('#666').fontSize(8).text(item.label, startX + 5, doc.y - 40, { width: 100, align: 'center' });
      doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(item.value, startX + 5, doc.y - 12, { width: 100, align: 'center' });
      startX += 125;
      if (startX > 450) { startX = 50; doc.moveDown(4); }
    });
    doc.moveDown(5);
  }

  // Table
  const tableTop = doc.y;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#333');

  let x = 50;
  columns.forEach(col => {
    doc.text(col.header, x, tableTop, { width: col.width, align: col.align || 'left' });
    x += col.width;
  });

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#333').lineWidth(1).stroke();

  let y = tableTop + 25;
  doc.font('Helvetica').fontSize(8).fillColor('#000');

  data.forEach((row, rowIndex) => {
    if (y > 750) { doc.addPage(); y = 50; }

    // Zebra banding
    if (rowIndex % 2 === 0) {
      doc.rect(50, y - 2, 500, 14).fill('#fafafa').stroke();
      doc.fillColor('#000');
    }

    const fmtValue = (v) => (typeof v === 'number' ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (v || ''));

    x = 50;
    columns.forEach(col => {
      const val = row[col.key];
      doc.text(fmtValue(val), x, y, { width: col.width, align: col.align || 'left' });
      x += col.width;
    });
    y += 18;
  });

  return doc;
}

module.exports = {
  generateHash,
  genererNumeroFacture,
  genererNumeroAvoir,
  genererFacturePDF,
  genererFactureJSON,
  genererFactureBatchPDF,
  genererReleveClientPDF,
  genererRapportPDF
};
