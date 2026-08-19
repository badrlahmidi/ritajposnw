# Task 7: Fix route ordering in products.js

## Summary

Fixed Express route ordering in `server/routes/products.js` so that static routes (`/dlc/alertes`, `/import`) are registered BEFORE the `:id` parameterized routes. This prevents Express from matching `/dlc/alertes` against `/:id` and treating `dlc` as an ID.

## Changes Made

### Route reordering

Moved the following routes to be before any `/:id` routes:

1. **`/dlc/alertes`** (line 59) - Moved from after `/:id/variantes` to before all `/:id` routes
2. **`/import`** (line 83) - Moved from after `/:id/variantes` to before all `/:id` routes

### Final route order

```
1. router.get('/', ...)                                          // static
2. router.get('/code-barre/:code', ...)                        // has :code param but specific pattern
3. router.get('/dlc/alertes', ...)                             // static - WAS AFTER /:id, NOW BEFORE
4. router.post('/import', ...)                                 // static - WAS AFTER /:id, NOW BEFORE
5. router.get('/:id/variantes', ...)                           // first /:id route
6. router.post('/:id/variantes', ...)                          // /:id route
7. router.post('/', ...)                                         // static
8. router.put('/:id', ...)                                       // /:id route
9. router.delete('/:id', ...)                                    // /:id route
```

## Root Cause

Express matches routes in the order they are defined. Since `/:id` is a parameterized route that can match any single path segment, routes defined after `/:id` could potentially be matched incorrectly. The `/dlc/alertes` route was defined at line 59 (after `/code-barre/:code` at line 32 but before `/:id/variantes` at line 82 in the original), but the `/import` route was defined at line 140, after some `/:id` routes had already been defined.

## Testing

All product-related tests pass:
- `tests/produits.test.js` - 9/9 tests pass
- `tests/security.test.js` - All tests pass including `POST /produits rejette prix négatif`
- `tests/auth.test.js` - All 9 tests pass
- `tests/security.test.js` - `POST /clients rejette email invalide` and `POST /fournisseurs rejette sans adminOnly`

Reported test suites (failures pre-existing, unrelated to this change):
- `tests/api-comprehensive.test.js` - Delivery API issues
- `tests/dgi-xml.test.js` - XML generation issues
- `tests/dgi-compliance.test.js` - DGII compliance issues
- `tests/commandes.test.js` - Order/flow issues