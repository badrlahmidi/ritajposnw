# Task 2: Add NaN Guard on parseInt Params

## Status: DONE

## Commit
- `dba73a3` — `fix: add NaN guards on all parseInt route params`

## Test Summary
149 tests passed, 0 failed across 10 test suites. ESLint clean.

## Changes

Added `parseInt(value, 10)` with radix 10 and `isNaN()` guard returning `400 { error: 'ID invalide' }` in **12 route files** covering **36 total `parseInt(req.params.*)` call sites**:

| File | Guards Added |
|------|-------------|
| `categories.js` | 2 (PUT, DELETE) |
| `products.js` | 4 (GET variantes, POST variantes, PUT, DELETE) |
| `clients.js` | 6 (PUT, GET credits, POST credits, POST regler-credit, GET releve/pdf, DELETE) |
| `orders.js` | 4 (GET detail, PUT statut, POST facturer, PUT annuler) |
| `invoices.js` | 4 (GET pdf, GET json, GET xml, GET xml/validate) |
| `users.js` | 2 (PUT, DELETE) |
| `stock.js` | 3 (PUT produit_id, POST inventory scan, POST inventory commit) |
| `taxes.js` | 2 (PUT, DELETE) |
| `deliveries.js` | 1 (PUT statut) |
| `discounts.js` | 2 (DELETE, PUT) — DELETE was inline, extracted to variable |
| `succursales.js` | 4 (GET detail, PUT, PATCH toggle, GET stats) |
| `suppliers.js` | 2 (PUT, DELETE) |

## Files NOT Modified (no parseInt on params)
- `auth.js` — no URL param parsing
- `caisse.js` — no URL param parsing
- `expenses.js` — no URL param parsing
- `system.js` — no URL param parsing (uses `parseInt(lim)` for query params with fallback `|| 200`)
- `health.js` — no URL param parsing
- `stats/` subroutes — no URL param parsing

## Pattern Applied
```js
const id = parseInt(req.params.id, 10);
if (isNaN(id)) { return res.status(400).json({ error: 'ID invalide' }); }
```

## Notes
- `parseInt(req.query.*)` calls (e.g. `parseInt(req.query.jours) || 7` in products.js, `parseInt(lim) || 200` in orders.js/system.js) were **not** guarded since the task scope was URL params only, and query params already have safe fallbacks.
- The `parseInt(req.query.jours)` in products.js DLC alertes route uses `|| 7` fallback so NaN → 0 which is a minor behavior change if someone passes `?jours=abc`, but this is out of scope.
- All radix-10 additions are consistent across files for best practice.
