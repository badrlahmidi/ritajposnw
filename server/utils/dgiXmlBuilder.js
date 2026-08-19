const { create } = require('xmlbuilder2');
const crypto = require('crypto');

const NS_UBL = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';

function tvaBreakdown(lines) {
  const map = {};
  lines.forEach(l => {
    const taux = parseFloat(l.taux_tva) || 0;
    if (!map[taux]) {map[taux] = { base: 0, montant: 0 };}
    map[taux].base += parseFloat(l.sous_total_ht) || 0;
    map[taux].montant += parseFloat(l.montant_tva) || 0;
  });
  return Object.entries(map).map(([taux, data]) => ({
    taux: parseFloat(taux),
    base: Math.round(data.base * 100) / 100,
    montant: Math.round(data.montant * 100) / 100
  }));
}

function buildInvoiceXML({ commande, lignes, params, client }) {
  if (!commande || !lignes || !params) {
    throw new Error('Données facture incomplètes pour génération XML');
  }

  const numeroFacture = commande.numero_facture || `FA-${commande.numero}`;
  const hash = commande.hash_integrite || crypto.createHash('sha256').update(
    [commande.numero || '', commande.date_creation || '', String(commande.total || 0), params.ice || ''].join('|'), 'utf8'
  ).digest('hex');

  const fullHash = `sha256:${hash}`;

  const tva = tvaBreakdown(lignes);
  const totalHT = lignes.reduce((s, l) => s + (parseFloat(l.sous_total_ht) || 0), 0);
  const totalTTC = parseFloat(commande.total) || 0;
  const totalRemise = parseFloat(commande.remise_montant) || 0;

  const isB2B = client && (client.ice || client.if_number || client.rc_number);
  const clientICE = client && client.ice ? client.ice : '';
  const clientIF = client && client.if_number ? client.if_number : '';
  const clientRC = client && client.rc_number ? client.rc_number : '';
  const clientNom = client ? (client.raison_sociale || client.nom) : (commande.client_nom || 'Client comptoir');
  const clientAdresse = client ? (client.adresse || '') : '';

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Invoice', {
      xmlns: NS_UBL,
      'xmlns:cac': NS_CAC,
      'xmlns:cbc': NS_CBC,
      'xmlns:ext': NS_EXT,
      'xmlns:ds': NS_DS,
      'xmlns:xsi': NS_XSI,
      'xsi:schemaLocation': `${NS_UBL} UBL-Invoice-2.1.xsd`
    });

  root.ele('cbc:UBLVersionID').txt('2.1').up();
  root.ele('cbc:CustomizationID').txt('DGI-MAROC-2026').up();
  root.ele('cbc:ID').txt(numeroFacture).up();
  root.ele('cbc:IssueDate').txt((commande.date_creation || new Date().toISOString()).split('T')[0]).up();
  root.ele('cbc:IssueTime').txt((commande.date_creation || new Date().toISOString()).split('T')[1]?.split('.')[0] || '00:00:00').up();
  root.ele('cbc:InvoiceTypeCode', { listID: 'DGI-MAROC', name: commande.statut === 'annulee' ? 'Avoir' : 'Facture' })
    .txt(commande.statut === 'annulee' ? '381' : '380').up();
  root.ele('cbc:DocumentCurrencyCode').txt('MAD').up();
  root.ele('cbc:LineCountNumeric').txt(String(lignes.length)).up();

  const ext = root.ele('ext:UBLExtensions');
  const ext1 = ext.ele('ext:UBLExtension');
  ext1.ele('ext:ExtensionContent');
  ext1.up();
  ext.up();

  const accSup = root.ele('cac:AccountingSupplierParty');
  const supParty = accSup.ele('cac:Party');
  const supId = supParty.ele('cac:PartyIdentification');
  supId.ele('cbc:ID', { schemeID: 'ICE' }).txt(params.ice || '').up();
  supId.up();
  if (params.identifiant_fiscal) {
    const supId2 = supParty.ele('cac:PartyIdentification');
    supId2.ele('cbc:ID', { schemeID: 'IF' }).txt(params.identifiant_fiscal).up();
    supId2.up();
  }
  if (params.registre_commerce) {
    const supId3 = supParty.ele('cac:PartyIdentification');
    supId3.ele('cbc:ID', { schemeID: 'RC' }).txt(params.registre_commerce).up();
    supId3.up();
  }
  if (params.numero_patente) {
    const supId4 = supParty.ele('cac:PartyIdentification');
    supId4.ele('cbc:ID', { schemeID: 'Patente' }).txt(params.numero_patente).up();
    supId4.up();
  }
  const supName = supParty.ele('cac:PartyName');
  supName.ele('cbc:Name').txt(params.raison_sociale || params.nom_commerce || '').up();
  supName.up();
  const supAddr = supParty.ele('cac:PostalAddress');
  supAddr.ele('cbc:StreetName').txt(params.adresse || '').up();
  supAddr.ele('cbc:CityName').txt('').up();
  supAddr.ele('cbc:CountrySubentity').txt('').up();
  const supCountry = supAddr.ele('cac:Country');
  supCountry.ele('cbc:IdentificationCode').txt('MA').up();
  supCountry.up();
  supAddr.up();
  const supContact = supParty.ele('cac:Contact');
  supContact.ele('cbc:Telephone').txt(params.telephone || '').up();
  supContact.up();
  supParty.up();
  accSup.up();

  const accCust = root.ele('cac:AccountingCustomerParty');
  const custParty = accCust.ele('cac:Party');
  if (isB2B) {
    if (clientICE) {
      const cid = custParty.ele('cac:PartyIdentification');
      cid.ele('cbc:ID', { schemeID: 'ICE' }).txt(clientICE).up();
      cid.up();
    }
    if (clientIF) {
      const cid2 = custParty.ele('cac:PartyIdentification');
      cid2.ele('cbc:ID', { schemeID: 'IF' }).txt(clientIF).up();
      cid2.up();
    }
    if (clientRC) {
      const cid3 = custParty.ele('cac:PartyIdentification');
      cid3.ele('cbc:ID', { schemeID: 'RC' }).txt(clientRC).up();
      cid3.up();
    }
    const cName = custParty.ele('cac:PartyName');
    cName.ele('cbc:Name').txt(clientNom).up();
    cName.up();
    const cAddr = custParty.ele('cac:PostalAddress');
    cAddr.ele('cbc:StreetName').txt(clientAdresse).up();
    cAddr.ele('cac:Country');
    cAddr.ele('cbc:IdentificationCode').txt('MA').up();
    cAddr.up();
  } else {
    const cid = custParty.ele('cac:PartyIdentification');
    cid.ele('cbc:ID', { schemeID: 'ICE' }).txt('999999999999999').up();
    cid.up();
    const cName = custParty.ele('cac:PartyName');
    cName.ele('cbc:Name').txt(clientNom).up();
    cName.up();
  }
  custParty.up();
  accCust.up();

  tva.forEach(t => {
    const taxTotal = root.ele('cac:TaxTotal');
    taxTotal.ele('cbc:TaxAmount', { currencyID: 'MAD' }).txt(t.montant.toFixed(2)).up();
    const subTotal = taxTotal.ele('cac:TaxSubtotal');
    subTotal.ele('cbc:TaxableAmount', { currencyID: 'MAD' }).txt(t.base.toFixed(2)).up();
    subTotal.ele('cbc:TaxAmount', { currencyID: 'MAD' }).txt(t.montant.toFixed(2)).up();
    const cat = subTotal.ele('cac:TaxCategory');
    const scheme = cat.ele('cac:TaxScheme');
    scheme.ele('cbc:ID').txt('VAT').up();
    scheme.ele('cbc:Name').txt('TVA').up();
    scheme.up();
    cat.ele('cbc:Percent').txt(String(t.taux)).up();
    cat.up();
    subTotal.up();
    taxTotal.up();
  });

  lignes.forEach((l, i) => {
    const line = root.ele('cac:InvoiceLine');
    line.ele('cbc:ID').txt(String(i + 1)).up();
    line.ele('cbc:InvoicedQuantity', { unitCode: 'C62' }).txt(String(parseFloat(l.quantite) || 0)).up();
    line.ele('cbc:LineExtensionAmount', { currencyID: 'MAD' }).txt((parseFloat(l.sous_total_ht) || 0).toFixed(2)).up();

    const item = line.ele('cac:Item');
    item.ele('cbc:Name').txt(l.nom_produit || '').up();
    item.up();

    const price = line.ele('cac:Price');
    price.ele('cbc:PriceAmount', { currencyID: 'MAD' }).txt((parseFloat(l.prix_unitaire_ht) || 0).toFixed(2)).up();
    price.up();

    line.up();
  });

  const legalTotal = root.ele('cac:LegalMonetaryTotal');
  legalTotal.ele('cbc:LineExtensionAmount', { currencyID: 'MAD' }).txt(totalHT.toFixed(2)).up();
  if (totalRemise > 0) {
    legalTotal.ele('cbc:AllowanceTotalAmount', { currencyID: 'MAD' }).txt(totalRemise.toFixed(2)).up();
  }
  legalTotal.ele('cbc:TaxExclusiveAmount', { currencyID: 'MAD' }).txt(totalHT.toFixed(2)).up();
  legalTotal.ele('cbc:TaxInclusiveAmount', { currencyID: 'MAD' }).txt(totalTTC.toFixed(2)).up();
  legalTotal.ele('cbc:PayableAmount', { currencyID: 'MAD' }).txt(totalTTC.toFixed(2)).up();
  legalTotal.up();

  const integrityRoot = root.ele('cbc:DocumentIntegrityHash');
  integrityRoot.txt(fullHash);
  integrityRoot.up();

  const xmlStr = root.end({ prettyPrint: true, headless: false });
  return xmlStr;
}

function validateFiscalFields({ commande, lignes, params, client }) {
  const errors = [];

  if (!params.ice) {errors.push('ICE du vendeur manquant');}
  if (!params.identifiant_fiscal) {errors.push('Identifiant Fiscal (IF) du vendeur manquant');}
  if (!params.registre_commerce) {errors.push('Registre de Commerce (RC) du vendeur manquant');}
  if (!params.numero_patente) {errors.push('Numéro de patente du vendeur manquant');}
  if (!params.raison_sociale && !params.nom_commerce) {errors.push('Raison sociale du vendeur manquante');}
  if (!params.adresse) {errors.push('Adresse fiscale du vendeur manquante');}

  if (!commande) {errors.push('Commande introuvable');}
  if (!lignes || lignes.length === 0) {errors.push('Aucune ligne de facture');}

  if (client) {
    if (client.ice && !/^\d{15}$/.test(client.ice)) {
      errors.push('ICE client invalide (doit contenir 15 chiffres)');
    }
  }

  return errors;
}

module.exports = { buildInvoiceXML, validateFiscalFields, tvaBreakdown };