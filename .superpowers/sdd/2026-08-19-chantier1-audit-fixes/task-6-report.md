# Task 6: Add express-validator rules on missing routes

## Status: DONE

## Summary

Added `express-validator` validation rules to four routes that previously lacked proper validation:

1. **`PUT /clients/:id`** — validates `nom` is present and not empty (optional), `telephone` optional with Moroccan phone format
2. **`POST /caisse/mouvements`** — validates `montant` is a positive number, `type` is in allowed values (`depot`, `retrait`)
3. **`POST /livraisons`** — validates `commande_id` is present and is a valid integer
4. **`POST /depenses`** — already had validation via `createExpenseRules` (no changes needed)

## Changes Made

### `server/validators.js`
- Added `updateClientRules` — validates optional `nom` (not empty if present), optional `telephone` (Moroccan format), optional `email`
- Added `createCashMovementRules` — validates required `montant` (positive float), required `type` (must be `depot` or `retrait`), optional `motif`
- Added `createDeliveryRules` — validates required `commande_id` (integer ≥ 1), optional `adresse`, `telephone`, `frais_livraison`
- Exported all three new rule sets

### `server/routes/clients.js`
- Added `v.updateClientRules, v.handleValidation` middleware to `PUT /:id` route

### `server/routes/caisse.js`
- Added `v.createCashMovementRules, v.handleValidation` middleware to `POST /mouvements` route

### `server/routes/deliveries.js`
- Imported `v` from `../validators`
- Added `v.createDeliveryRules, v.handleValidation` middleware to `POST /` route

### `server/routes/expenses.js`
- No changes needed — validation was already present via `createExpenseRules`

## Test Results

All **149 tests pass** across 10 test suites:
- `api-comprehensive.test.js` (PASS)
- `security.test.js` (PASS)
- `auth.test.js` (PASS)
- `dgi-compliance.test.js` (PASS)
- `commandes.test.js` (PASS)
- `dgi-xml.test.js` (PASS)
- `clients-stock.test.js` (PASS)
- `produits.test.js` (PASS)
- `facture.test.js` (PASS)
- `sanitize.test.js` (PASS)

No existing test expectations were broken.

## ESLint

ESLint is not configured for this project (no `eslint.config.js` or `.eslintrc.*` file found). Skipped.

## Commit

- **SHA:** `4743705`
- **Message:** `fix: add express-validator rules on unvalidated routes`

## Concerns

None — all validation follows the existing centralized pattern in `server/validators.js` and all tests pass.
