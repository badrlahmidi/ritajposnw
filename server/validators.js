/**
 * ═══════════════════════════════════════════════════════════════
 *  RITAJ SMART POS — Schémas de validation (express-validator)
 *  Validation centralisée pour toutes les routes critiques
 * ═══════════════════════════════════════════════════════════════
 */
const { body, query, param, validationResult } = require('express-validator');

// ─── Middleware de résultat — à chaîner après les règles ─────────────────────
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array().map(e => ({ champ: e.path, message: e.msg })),
    });
  }
  next();
}

// ═══════════════════ SCHÉMAS PAR ROUTE ═══════════════════

// ── AUTH ──────────────────────────────────────────────────
const loginRules = [
  body('login')
    .trim()
    .notEmpty().withMessage('Le login est requis')
    .isLength({ min: 2, max: 50 }).withMessage('Login: 2–50 caractères'),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 4, max: 100 }).withMessage('Mot de passe: 4–100 caractères'),
];

// ── SETUP ────────────────────────────────────────────────
const setupCompleteRules = [
  body('profile_id')
    .trim()
    .notEmpty().withMessage('Profil métier requis'),
  body('admin.login')
    .trim()
    .notEmpty().withMessage('Login admin requis')
    .isLength({ min: 2, max: 50 }).withMessage('Login admin: 2–50 caractères'),
  body('admin.password')
    .notEmpty().withMessage('Mot de passe admin requis')
    .isLength({ min: 4 }).withMessage('Mot de passe admin: min 4 caractères'),
];

// ── UTILISATEURS ─────────────────────────────────────────
const createUserRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom est requis')
    .isLength({ max: 100 }).withMessage('Nom: max 100 caractères'),
  body('login')
    .trim()
    .notEmpty().withMessage('Le login est requis')
    .isLength({ min: 2, max: 50 }).withMessage('Login: 2–50 caractères'),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 4 }).withMessage('Mot de passe: min 4 caractères'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Email invalide'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'caissier']).withMessage('Rôle invalide (admin, manager, caissier)'),
];

const updateUserRules = [
  param('id').isInt({ min: 1 }).withMessage('ID utilisateur invalide'),
  body('nom')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Nom: max 100 caractères'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Email invalide'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'caissier']).withMessage('Rôle invalide'),
  body('password')
    .optional()
    .isLength({ min: 4 }).withMessage('Mot de passe: min 4 caractères'),
];

// ── PRODUITS ─────────────────────────────────────────────
const createProductRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom du produit est requis')
    .isLength({ max: 200 }).withMessage('Nom: max 200 caractères'),
  body('prix_ttc')
    .notEmpty().withMessage('Le prix TTC est requis')
    .isFloat({ min: 0 }).withMessage('Le prix TTC doit être un nombre positif'),
  body('categorie_id')
    .optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('ID catégorie invalide'),
  body('taxe_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID taxe invalide'),
  body('cout_revient')
    .optional()
    .isFloat({ min: 0 }).withMessage('Le coût de revient doit être positif'),
  body('stock_initial')
    .optional()
    .isFloat({ min: 0 }).withMessage('Le stock initial doit être positif'),
];

const updateProductRules = [
  param('id').isInt({ min: 1 }).withMessage('ID produit invalide'),
  body('nom')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Nom: max 200 caractères'),
  body('prix_ttc')
    .optional()
    .isFloat({ min: 0 }).withMessage('Le prix TTC doit être un nombre positif'),
];

// ── CATÉGORIES ───────────────────────────────────────────
const createCategoryRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom de la catégorie est requis')
    .isLength({ max: 100 }).withMessage('Nom: max 100 caractères'),
  body('couleur')
    .optional()
    .matches(/^#[0-9a-fA-F]{6}$/).withMessage('Couleur: format hexadécimal (#RRGGBB)'),
  body('ordre')
    .optional()
    .isInt({ min: 0 }).withMessage('Ordre: entier positif'),
];

// ── COMMANDES ────────────────────────────────────────────
const createOrderRules = [
  body('lignes')
    .isArray({ min: 1 }).withMessage('La commande doit contenir au moins un article'),
  body('lignes.*.produit_id')
    .isInt({ min: 1 }).withMessage('ID produit invalide dans une ligne'),
  body('lignes.*.quantite')
    .optional()
    .isFloat().withMessage('Quantité: nombre valide (positif ou négatif)'),
  body('mode_paiement')
    .optional()
    .isIn(['especes', 'carte', 'mixte', 'credit', 'attente']).withMessage('Mode de paiement invalide'),
  body('type_commande')
    .optional()
    .isIn(['sur_place', 'emporter', 'livraison', 'standard', 'retour']).withMessage('Type de commande invalide'),
  body('montant_recu')
    .optional()
    .isFloat().withMessage('Montant reçu: nombre valide (positif ou négatif)'),
  body('remise_montant')
    .optional()
    .isFloat({ min: 0 }).withMessage('Remise: nombre positif'),
];

// ── CLIENTS ──────────────────────────────────────────────
const createClientRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom du client est requis')
    .isLength({ max: 200 }).withMessage('Nom: max 200 caractères'),
  body('telephone')
    .optional({ values: 'falsy' })
    .isMobilePhone('ar-MA').withMessage('Numéro de téléphone marocain invalide'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Email invalide'),
];

// ── STOCK ────────────────────────────────────────────────
const updateStockRules = [
  param('produit_id').isInt({ min: 1 }).withMessage('ID produit invalide'),
  body('quantite')
    .notEmpty().withMessage('La quantité est requise')
    .isFloat().withMessage('Quantité: nombre valide'),
  body('seuil_alerte')
    .optional()
    .isFloat({ min: 0 }).withMessage('Seuil alerte: nombre positif'),
];

// ── DÉPENSES ─────────────────────────────────────────────
const createExpenseRules = [
  body('categorie')
    .trim()
    .notEmpty().withMessage('La catégorie est requise'),
  body('montant')
    .notEmpty().withMessage('Le montant est requis')
    .isFloat({ min: 0.01 }).withMessage('Montant: nombre positif'),
  body('mode_paiement')
    .optional()
    .isIn(['especes', 'carte', 'virement', 'cheque']).withMessage('Mode de paiement invalide'),
  body('date_depense')
    .optional()
    .isDate().withMessage('Date invalide (format YYYY-MM-DD)'),
];

// ── REMISES ──────────────────────────────────────────────
const createDiscountRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom de la remise est requis'),
  body('valeur')
    .notEmpty().withMessage('La valeur est requise')
    .isFloat({ min: 0 }).withMessage('Valeur: nombre positif'),
  body('type')
    .optional()
    .isIn(['pourcentage', 'montant']).withMessage('Type: pourcentage ou montant'),
];

// ── CAISSE ───────────────────────────────────────────────
const openCashRegisterRules = [
  body('fond_caisse')
    .optional()
    .isFloat({ min: 0 }).withMessage('Fond de caisse: nombre positif'),
];

const closeCashRegisterRules = [
  body('montant_reel')
    .notEmpty().withMessage('Le montant réel est requis')
    .isFloat({ min: 0 }).withMessage('Montant réel: nombre positif'),
];

// ── TAXES ────────────────────────────────────────────────
const createTaxRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom de la taxe est requis'),
  body('taux')
    .notEmpty().withMessage('Le taux est requis')
    .isFloat({ min: 0, max: 100 }).withMessage('Taux: entre 0 et 100'),
];

// ── FOURNISSEURS ─────────────────────────────────────────
const createSupplierRules = [
  body('nom')
    .trim()
    .notEmpty().withMessage('Le nom du fournisseur est requis')
    .isLength({ max: 200 }).withMessage('Nom: max 200 caractères'),
  body('telephone')
    .optional({ values: 'falsy' })
    .isLength({ max: 20 }).withMessage('Téléphone: max 20 caractères'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Email invalide'),
];

// ── STATS ────────────────────────────────────────────────
const periodStatsRules = [
  query('date_debut')
    .notEmpty().withMessage('Date de début requise')
    .isDate().withMessage('Date de début invalide (YYYY-MM-DD)'),
  query('date_fin')
    .notEmpty().withMessage('Date de fin requise')
    .isDate().withMessage('Date de fin invalide (YYYY-MM-DD)'),
];

module.exports = {
  handleValidation,
  loginRules,
  setupCompleteRules,
  createUserRules,
  updateUserRules,
  createProductRules,
  updateProductRules,
  createCategoryRules,
  createOrderRules,
  createClientRules,
  updateStockRules,
  createExpenseRules,
  createDiscountRules,
  openCashRegisterRules,
  closeCashRegisterRules,
  createTaxRules,
  createSupplierRules,
  periodStatsRules,
};
