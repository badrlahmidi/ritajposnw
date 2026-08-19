# Task 3: Whitelist allowed fields in PUT /parametres

## Summary
Fixed mass assignment vulnerability in `PUT /parametres` route by applying `filterFields` from `server/utils/sanitize.js` to whitelist only allowed parameter keys before the database INSERT/REPLACE loop.

## What changed

**File:** `server/routes/system.js:106-143`

1. Added `const { filterFields } = require('../utils/sanitize');` import
2. Defined `ALLOWED_PARAM_KEYS` array with ~60 whitelisted parameter keys covering:
   - Commerce identity: `nom_commerce`, `raison_sociale`, `adresse`, `telephone`, `email`
   - Fiscal IDs: `ice`, `identifiant_fiscal`, `registre_commerce`, `numero_patente`, `cnss`
   - Config: `devise`, `devise_symbole`, `monnaie`, `tva_defaut`, `tva_default`
   - Loyalty: `points_par_dh`, `seuil_points_cadeau`
   - App settings: `app_mode`, `app_nom`, `app_logo`, `type_commerce`, `types_commande`, `setup_completed`
   - Ticket display: 18 `ticket_show_*` toggles + `ticket_header`, `ticket_footer`, `ticket_message_promo`, `ticket_font_size`, `ticket_largeur`
   - Feature flags: 10 `feature_*` keys (fidelite, livraison, pourboire, dlc, credit, negative_stock, sur_place, emporter, tables, kds)
   - Payment methods: `paiement_cheque`, `paiement_virement`
   - Backup/ops: `backup_auto`, `backup_heure`, `backup_cle_api`
   - Legacy/task-specified: `caisse_id`, `nom_magasin`, `adresse_magasin`, `telephone_magasin`, `email_magasin`, `langue`, `logo_path`, `mot_de_passe_admin`, `mode_lente`, `seuil_alerte_stock`
3. Applied `filterFields(req.body, ALLOWED_PARAM_KEYS)` before the loop — unknown keys are silently dropped

## Why this whitelist

The `parametres` table is a key-value store (`cle TEXT PRIMARY KEY, valeur TEXT`). The frontend admin panel (`admin.js:saveParametres()`) collects values from `[data-key]` inputs, ticket toggle options, feature flags, and payment options. All existing tests send keys that are in this whitelist. Business profiles (`business-profiles.js`) set `parametres_defaults` via a separate code path (setup), not through this PUT route.

## Verification

- **149/149 tests pass** (10 test suites, 0 failures)
- All PUT /parametres test cases continue to work: `api-comprehensive`, `clients-stock`, `dgi-compliance`, `dgi-xml`
