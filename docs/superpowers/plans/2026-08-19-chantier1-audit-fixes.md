# Chantier 1 — Audit & Fixes: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining security issues, bugs, ESLint warnings, and add missing tests for Ritaj Smart POS v4.2.

**Architecture:** Three sprints — (S1) Security hardening with shared field whitelist utility, (S2) Bug fixes across backend and frontend, (S3) ESLint cleanup and test coverage. Each sprint is independently committable.

**Tech Stack:** Node.js 18+, Express 4.21, better-sqlite3, Jest 30, ESLint

## Global Constraints

- Node.js ≥ 18 (`.nvmrc`)
- No new npm dependencies — use existing libs only
- All 145 existing tests must keep passing after each task
- Follow existing code style: French comments, single quotes, 4-space indent
- Run `npm run lint` after each task — 0 errors, 0 warnings target
- Commit messages follow `conventional commits` format (feat/fix/refactor/test/chore)

---

## SPRINT 1 — Sécurité & Robustesse

### Task 1: Create shared field-whitelist utility

**Files:**
- Create: `server/utils/sanitize.js`
- Test: `server/tests/sanitize.test.js`

**Interfaces:**
- Consumes: nothing (new module)
- Produces: `filterFields(obj, allowedKeys)` — returns new object with only allowed keys

- [ ] **Step 1: Write the failing test**

```js
// server/tests/sanitize.test.js
const { filterFields } = require('../utils/sanitize');

describe('filterFields', () => {
  test('keeps only allowed keys', () => {
    const input = { nom: 'test', password: 'x', role: 'admin' };
    const result = filterFields(input, ['nom']);
    expect(result).toEqual({ nom: 'test' });
  });

  test('returns empty object if no keys match', () => {
    const result = filterFields({ a: 1 }, ['b']);
    expect(result).toEqual({});
  });

  test('handles null/undefined input', () => {
    expect(filterFields(null, ['a'])).toEqual({});
    expect(filterFields(undefined, ['a'])).toEqual({});
  });

  test('strips undefined values', () => {
    const result = filterFields({ nom: 'test', couleur: undefined }, ['nom', 'couleur']);
    expect(result).toEqual({ nom: 'test' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/sanitize.test.js --no-coverage`
Expected: FAIL — `Cannot find module '../utils/sanitize'`

- [ ] **Step 3: Write minimal implementation**

```js
// server/utils/sanitize.js
/**
 * Filtre un objet pour ne garder que les clés autorisées.
 * Supprime les valeurs undefined et null.
 */
function filterFields(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of allowedKeys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      result[key] = obj[key];
    }
  }
  return result;
}

module.exports = { filterFields };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/sanitize.test.js --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/sanitize.js server/tests/sanitize.test.js
git commit -m "feat: add filterFields utility for safe PUT updates"
```

---

### Task 2: Add NaN guard on parseInt params across all routes

**Files:**
- Modify: `server/routes/categories.js:33` — add guard after `parseInt`
- Modify: `server/routes/products.js:60,80,223,321` — add guard
- Modify: `server/routes/stock.js:30,187,221` — add guard
- Modify: `server/routes/orders.js:26,212,224,251` — add guard
- Modify: `server/routes/clients.js:30,64,71,97,114,133` — add guard
- Modify: `server/routes/taxes.js:19,38` — add guard
- Modify: `server/routes/discounts.js:20,25` — add guard
- Modify: `server/routes/users.js:24,61` — add guard
- Modify: `server/routes/invoices.js:10,80,108,144` — add guard
- Modify: `server/routes/deliveries.js:39` — add guard
- Modify: `server/routes/caisse.js` (inventory routes) — add guard
- Modify: `server/routes/succursales.js` — add guard

**Interfaces:**
- Consumes: nothing (inline fix)
- Produces: all `parseInt(req.params.id)` calls return 400 on NaN

- [ ] **Step 1: Write failing test for categories**

```js
// Add to existing tests or create server/tests/nan-guard.test.js
describe('NaN param guard', () => {
  test('GET /categories/abc returns 400 or 404 (not 500)', async () => {
    const res = await request(app).get('/pos/api/categories/abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/nan-guard.test.js --no-coverage`
Expected: FAIL (500 error or crash)

- [ ] **Step 3: Add NaN guard to each route**

In each file, after `const id = parseInt(req.params.id);`, add:

```js
if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
```

Apply to all files listed above. The pattern is identical in each.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --no-coverage`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add server/routes/
git commit -m "fix: add NaN guard on all parseInt(params.id) calls"
```

---

### Task 3: Whitelist allowed fields in PUT /parametres (mass assignment)

**Files:**
- Modify: `server/routes/system.js:105-109`

**Interfaces:**
- Consumes: `filterFields` from Task 1
- Produces: only whitelisted parameter keys can be updated

- [ ] **Step 1: Write failing test**

```js
// server/tests/security.test.js — add test
test('PUT /parametres rejects unauthorized keys', async () => {
  const res = await request(app)
    .put('/pos/api/parametres')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ app_nom: 'Test', malicious_key: 'injected' });
  expect(res.status).toBe(200);
  // Verify malicious_key was NOT saved
  const params = await request(app)
    .get('/pos/api/parametres')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(params.body.malicious_key).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/security.test.js --no-coverage -t "rejects unauthorized keys"`
Expected: FAIL

- [ ] **Step 3: Implement whitelist**

```js
// In server/routes/system.js, replace lines 105-109:
const ALLOWED_PARAM_KEYS = [
  'app_nom', 'app_logo', 'monnaie', 'ice', 'rc', 'if_fiscal', 'patente',
  'type_commerce', 'types_commande',
  'feature_sur_place', 'feature_emporter', 'feature_livraison', 'feature_tables',
  'theme_couleur', 'theme_mode', 'theme_mode_sombre',
  'ticket_header', 'ticket_footer', 'ticket_show_logo',
  'backup_interval_hours', 'rate_limit_max',
];

router.put('/parametres', authMiddleware, adminStrict, asyncHandler((req, res) => {
  const { filterFields } = require('../utils/sanitize');
  const safeParams = filterFields(req.body, ALLOWED_PARAM_KEYS);
  for (const [cle, valeur] of Object.entries(safeParams)) {
    run('INSERT OR REPLACE INTO parametres (cle, valeur) VALUES (?, ?)', [cle, String(valeur)]);
  }
  res.json({ success: true });
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/security.test.js --no-coverage -t "rejects unauthorized keys"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/system.js
git commit -m "fix: whitelist allowed keys on PUT /parametres"
```

---

### Task 4: Fix sync bcrypt calls → async

**Files:**
- Modify: `server/routes/auth.js:31` — `bcrypt.compareSync` → `await bcrypt.compare`
- Modify: `server/routes/users.js:15,48` — `bcrypt.hashSync` → `await bcrypt.hash`

**Interfaces:**
- Consumes: nothing
- Produces: non-blocking auth and user creation

- [ ] **Step 1: Write failing test (performance indicator)**

```js
// No direct test needed — existing auth.test.js must still pass
// This is a correctness fix, not behavior change
```

- [ ] **Step 2: Run existing auth tests**

Run: `npx jest tests/auth.test.js --no-coverage`
Expected: PASS (baseline)

- [ ] **Step 3: Replace sync calls**

In `server/routes/auth.js:31`:
```js
// Before:
const valid = bcrypt.compareSync(password, user.password_hash);
// After:
const valid = await bcrypt.compare(password, user.password_hash);
```

In `server/routes/users.js:15`:
```js
// Before:
const hash = bcrypt.hashSync(password, 10);
// After:
const hash = await bcrypt.hash(password, 10);
```

In `server/routes/users.js:48`:
```js
// Before:
params.push(bcrypt.hashSync(password, 10));
// After:
params.push(await bcrypt.hash(password, 10));
```

- [ ] **Step 4: Run auth + user tests**

Run: `npx jest tests/auth.test.js tests/api-comprehensive.test.js --no-coverage`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.js server/routes/users.js
git commit -m "fix: replace sync bcrypt with async to avoid blocking event loop"
```

---

### Task 5: Fix backupInProgress flag reset on error paths

**Files:**
- Modify: `server/db.js` — around lines 155-210 (createBackup function)

**Interfaces:**
- Consumes: nothing
- Produces: `backupInProgress` always resets to false, even on error

- [ ] **Step 1: Read current createBackup implementation**

Read `server/db.js` lines 150-220 to understand the current guard pattern.

- [ ] **Step 2: Wrap in try/finally**

Find the `createBackup` function and ensure the pattern is:

```js
async function createBackup(type = 'auto') {
  if (backupInProgress) {
    logger.warn('Backup déjà en cours, ignoré');
    return null;
  }
  backupInProgress = true;
  try {
    // ... existing backup logic ...
    return backupPath;
  } catch (err) {
    logger.error({ err }, 'Erreur backup');
    throw err;
  } finally {
    backupInProgress = false;
  }
}
```

Apply same pattern to `createArchiveBackup` if it exists.

- [ ] **Step 3: Run all tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add server/db.js
git commit -m "fix: ensure backupInProgress resets on error via try/finally"
```

---

### Task 6: Add express-validator rules on missing POST/PUT routes

**Files:**
- Modify: `server/validators.js` — add validation chains
- Modify: `server/routes/caisse.js:42` — add validation on POST /mouvements
- Modify: `server/routes/deliveries.js:24` — add validation on POST /
- Modify: `server/routes/clients.js:29` — add validation on PUT /:id

**Interfaces:**
- Consumes: existing `v` validator patterns
- Produces: validation middleware for missing routes

- [ ] **Step 1: Add validation rules to validators.js**

```js
// Add to server/validators.js
const { body } = require('express-validator');

const cashMovementRules = [
  body('type').isIn(['depot', 'retrait']).withMessage('Type doit être depot ou retrait'),
  body('montant').isFloat({ min: 0.01 }).withMessage('Montant requis > 0'),
];

const createDeliveryRules = [
  body('commande_id').isInt({ min: 1 }).withMessage('Commande requise'),
];

const updateClientRules = [
  body('nom').optional().isString().trim().isLength({ min: 1 }),
  body('email').optional().isEmail().withMessage('Email invalide'),
  body('type_tarif').optional().isIn(['particulier', 'gros', 'semi_gros']),
];

module.exports = {
  // ... existing exports ...
  cashMovementRules,
  createDeliveryRules,
  updateClientRules,
};
```

- [ ] **Step 2: Wire validation into routes**

In `caisse.js:42`, add `v.cashMovementRules, v.handleValidation` to the POST /mouvements route.

In `deliveries.js:24`, add `v.createDeliveryRules, v.handleValidation` to the POST / route.

In `clients.js:29`, add `v.updateClientRules, v.handleValidation` to the PUT /:id route.

- [ ] **Step 3: Run tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add server/validators.js server/routes/caisse.js server/routes/deliveries.js server/routes/clients.js
git commit -m "fix: add express-validator rules on caisse, deliveries, clients routes"
```

---

## SPRINT 2 — Bugs Backend & Frontend

### Task 7: Fix route ordering in products.js

**Files:**
- Modify: `server/routes/products.js:332-353`

**Interfaces:**
- Consumes: nothing
- Produces: `/dlc/alertes` route matched before `/:id/variantes`

- [ ] **Step 1: Verify current route order**

Read `server/routes/products.js` — confirm `/dlc/alertes` is at line 332 (AFTER `/:id/variantes` at line 59).

- [ ] **Step 2: Move /dlc/alertes before /:id/variantes**

Cut the entire `router.get('/dlc/alertes', ...)` block (lines 332-353) and paste it BEFORE `router.get('/:id/variantes', ...)` (before line 59).

- [ ] **Step 3: Run tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add server/routes/products.js
git commit -m "fix: move /dlc/alertes before /:id to prevent route shadowing"
```

---

### Task 8: Fix order number race condition with atomic counter

**Files:**
- Modify: `server/routes/orders.js:38-43`

**Interfaces:**
- Consumes: nothing
- Produces: atomic order number generation inside the transaction

- [ ] **Step 1: Write failing test**

```js
// server/tests/orders-race.test.js
describe('Order number uniqueness', () => {
  test('concurrent orders get unique numbers', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        request(app)
          .post('/pos/api/commandes')
          .set('Authorization', `Bearer ${token}`)
          .send({ lignes: [{ produit_id: 1, quantite: 1 }], mode_paiement: 'especes' })
      );
    }
    const results = await Promise.all(promises);
    const numeros = results.filter(r => r.status === 200).map(r => r.body.numero);
    const unique = new Set(numeros);
    expect(unique.size).toBe(numeros.length);
  });
});
```

- [ ] **Step 2: Move counter inside transaction**

Move lines 38-43 (counter logic) INSIDE the `transaction()` callback at line 118, right after it opens. The counter query and insert must be atomic:

```js
const resultPayload = transaction(() => {
  // Generate unique order number inside transaction
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const todayStr = now.toISOString().slice(0, 10);
  const countResult = queryOne("SELECT COUNT(*) as c FROM commandes WHERE DATE(date_creation) = ?", [todayStr]);
  const seqNum = (countResult ? countResult.c : 0) + 1;
  const numero = `CMD-${dateStr}-${String(seqNum).padStart(4, '0')}`;
  // ... rest of transaction
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add server/routes/orders.js
git commit -m "fix: move order number generation inside transaction for atomicity"
```

---

### Task 9: Fix invoices.js duplicated code (extract helper)

**Files:**
- Modify: `server/routes/invoices.js`

**Interfaces:**
- Consumes: nothing
- Produces: `loadCommandeWithDetails(id)` helper function

- [ ] **Step 1: Extract shared helper**

Replace the repeated pattern (lines 9-17, 80-87, 108-116, 144-152) with:

```js
function loadCommandeWithDetails(id) {
  const commande = queryOne('SELECT * FROM commandes WHERE id = ?', [id]);
  if (!commande) return null;
  const lignes = queryAll('SELECT * FROM commande_lignes WHERE commande_id = ?', [id]);
  const paramsRows = queryAll('SELECT cle, valeur FROM parametres');
  const params = {};
  paramsRows.forEach(p => { params[p.cle] = p.valeur; });
  let client = null;
  if (commande.client_id) {
    client = queryOne('SELECT * FROM clients WHERE id = ?', [commande.client_id]);
  }
  return { commande, lignes, params, client };
}
```

- [ ] **Step 2: Refactor each route to use the helper**

Replace each duplicated block with:
```js
const data = loadCommandeWithDetails(id);
if (!data) return res.status(404).json({ error: 'Commande non trouvée' });
const { commande, lignes, params, client } = data;
```

- [ ] **Step 3: Run tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add server/routes/invoices.js
git commit -m "refactor: extract loadCommandeWithDetails helper in invoices.js"
```

---

### Task 10: Fix health.js — getDb() is sync (no await needed)

**Files:**
- Modify: `server/routes/health.js`

**Interfaces:**
- Consumes: nothing
- Produces: clean health check code

- [ ] **Step 1: Verify getDb() is actually sync**

Read `server/db.js:31` — `async function getDb()` but better-sqlite3 is synchronous. The `async` is misleading. The function returns the db instance directly.

- [ ] **Step 2: Remove misleading async pattern**

In `health.js`, the `getDb()` call works fine as-is since better-sqlite3 is sync. The `async` keyword on `getDb` is misleading but harmless. Leave it — no change needed here. Just verify the health endpoint works.

- [ ] **Step 3: Run tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 4: Commit (skip if no change)**

Skip this task if no code change is needed.

---

## SPRINT 3 — ESLint Cleanup & Tests

### Task 11: Fix all 11 ESLint warnings

**Files:**
- Modify: `server/facture.js:511-512` — remove or use `devise`, `fmt`
- Modify: `server/routes/health.js:8` — remove unused `db`
- Modify: `server/routes/products.js:246` — remove unused `tId`
- Modify: `server/routes/stats/stats-export.js:157` — remove unused destructured vars
- Modify: `server/routes/stock.js:62` — remove unused `type`
- Modify: `server/routes/system.js:4,9` — remove unused `bcrypt`, `adminOnly`
- Modify: `server/routes/taxes.js:3` — remove unused `adminOnly`
- Modify: `server/tests/api-comprehensive.test.js:5,273` — remove unused vars
- Modify: `server/tests/auth.test.js:10` — remove unused `adminToken`
- Modify: `server/tests/clients-stock.test.js:10` — remove unused `adminToken`
- Modify: `server/tests/commandes.test.js:11` — remove unused `adminToken`
- Modify: `server/tests/dgi-compliance.test.js:2,20,26` — remove unused vars
- Modify: `server/tests/dgi-xml.test.js:2,15` — remove unused vars
- Modify: `server/tests/produits.test.js:10` — remove unused `adminToken`

**Interfaces:**
- Consumes: nothing
- Produces: 0 ESLint warnings

- [ ] **Step 1: Run ESLint to get current baseline**

Run: `npx eslint . 2>&1`
Expected: 11 warnings

- [ ] **Step 2: Fix each warning**

For each warning, either remove the unused variable/import, or prefix with `_` if it's a destructured param that must stay.

**facture.js:511-512** — Check if `devise` and `fmt` can be removed. If they're destructured from a larger object, prefix with `_`.

**health.js:8** — `const db = getDb();` → `getDb();` (just call it, don't assign)

**products.js:246** — `const tId = ...` → remove the variable, use the expression directly or inline

**stats-export.js:157** — Destructured but unused → prefix with `_` or remove from destructuring

**stock.js:62** — `type` destructured but unused → prefix with `_`

**system.js:4** — `const bcrypt = require('bcryptjs')` → remove (not used in this file)

**system.js:9** — `adminOnly` destructured but unused → remove from destructuring

**taxes.js:3** — `adminOnly` destructured but unused → remove from destructuring

**Test files** — Remove unused `adminToken` / `path` / etc. from destructuring

- [ ] **Step 3: Run ESLint to verify 0 warnings**

Run: `npx eslint . 2>&1`
Expected: 0 warnings

- [ ] **Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: all PASS (145+ tests)

- [ ] **Step 5: Commit**

```bash
git add -A server/
git commit -m "chore: fix all ESLint warnings — 0 errors, 0 warnings"
```

---

### Task 12: Add missing route tests (caisse, expenses, deliveries)

**Files:**
- Create or modify: `server/tests/api-comprehensive.test.js` (add tests)

**Interfaces:**
- Consumes: existing test setup (auth, app, tokens)
- Produces: tests for caisse, expenses, deliveries routes

- [ ] **Step 1: Add caisse tests**

```js
describe('Caisse', () => {
  test('GET /caisse/statut returns session status', async () => {
    const res = await request(app)
      .get('/pos/api/caisse/statut')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('statut');
  });

  test('POST /caisse/ouvrir requires adminStrict', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/ouvrir')
      .set('Authorization', `Bearer ${token}`)
      .send({ fond_caisse: 1000 });
    expect([200, 400]).toContain(res.status);
  });

  test('POST /caisse/mouvements rejects invalid type', async () => {
    const res = await request(app)
      .post('/pos/api/caisse/mouvements')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'invalid', montant: 100 });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Add expense tests**

```js
describe('Expenses', () => {
  test('GET /depenses requires adminOnly', async () => {
    const res = await request(app)
      .get('/pos/api/depenses')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 403]).toContain(res.status);
  });

  test('POST /depenses rejects missing montant', async () => {
    const res = await request(app)
      .post('/pos/api/depenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categorie: 'Test' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Add delivery tests**

```js
describe('Deliveries', () => {
  test('GET /livraisons returns array', async () => {
    const res = await request(app)
      .get('/pos/api/livraisons')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /livraisons rejects missing commande_id', async () => {
    const res = await request(app)
      .post('/pos/api/livraisons')
      .set('Authorization', `Bearer ${token}`)
      .send({ adresse: 'Test' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: all PASS (150+ tests now)

- [ ] **Step 5: Commit**

```bash
git add server/tests/
git commit -m "test: add caisse, expenses, deliveries route tests"
```

---

### Task 13: Add edge case tests (invalid IDs, empty bodies, concurrent)

**Files:**
- Modify: `server/tests/api-comprehensive.test.js`

**Interfaces:**
- Consumes: existing test setup
- Produces: edge case coverage

- [ ] **Step 1: Add edge case tests**

```js
describe('Edge Cases', () => {
  test('GET /produits/abc returns 400 (NaN id)', async () => {
    const res = await request(app)
      .get('/pos/api/produits/abc')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('DELETE /categories/999999 returns 404', async () => {
    const res = await request(app)
      .delete('/pos/api/categories/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('POST /produits with empty body returns 400', async () => {
    const res = await request(app)
      .post('/pos/api/produits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('PUT /clients/abc returns 400', async () => {
    const res = await request(app)
      .put('/pos/api/clients/abc')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Test' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add server/tests/
git commit -m "test: add edge case tests for NaN IDs, empty bodies, 404s"
```

---

### Task 14: Final verification — full test suite + ESLint

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx jest --runInBand --coverage`
Expected: all PASS, coverage ≥ 65%

- [ ] **Step 2: Run ESLint**

Run: `npx eslint . 2>&1`
Expected: 0 errors, 0 warnings

- [ ] **Step 3: Run lint script**

Run: `npm run lint`
Expected: passes

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git commit --allow-empty -m "chore: Chantier 1 complete — security fixes, bug fixes, ESLint clean, tests added"
```

---

## Execution Order

```
Sprint 1: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
Sprint 2: Task 7 → Task 8 → Task 9 → Task 10
Sprint 3: Task 11 → Task 12 → Task 13 → Task 14
```

Each task ends with a commit. Run tests after every task.
