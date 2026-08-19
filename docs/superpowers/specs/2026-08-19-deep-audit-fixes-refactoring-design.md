# DESIGN SPEC — Deep Audit, Fixes & Refactoring — Ritaj Smart POS

> **Date:** 19 August 2026
> **Status:** Draft
> **Scope:** Full-stack audit, critical fixes, architectural refactoring, production readiness

---

## 1. Context

Ritaj Smart POS v4.2 is a Node.js/Express + SQLite + Vanilla JS SPA for retail POS targeting the Moroccan market (DGI fiscal compliance). Previous audits (July 2026) brought the score from 6/10 to 8.1/10 with 145 passing tests and 0 ESLint errors.

**Remaining issues identified:**
- 11 ESLint warnings (unused variables/imports)
- SQL interpolation in PUT routes (mass assignment risk)
- ~250 inline onclick handlers (CSP, maintainability)
- ~100 hardcoded CSS colors bypassing theme system
- Missing validation on several routes
- Inconsistent error handling patterns
- Hardcoded configuration values
- Test coverage at ~65% (target: 80%)

**Goal:** Execute 3 work streams (chantiers) sequentially to bring the codebase to production-ready quality.

---

## 2. Chantier 1: Audit Approfondi & Corrections Critiques

### Sprint 1 — Sécurité & Auth (Phase 1 + Phase 2)

**S1-P1: SQL Injection & Mass Assignment**

| Issue | File | Fix |
|-------|------|-----|
| PUT routes use `req.body` directly as column set — any field can be injected | categories.js, clients.js, products.js, taxes.js, users.js, discounts.js | Create `server/utils/sanitize.js` with `allowedFields(obj, whitelist)` utility. Apply whitelist per route. |
| PUT `/parametres` accepts any key — mass assignment | system.js:105-109 | Whitelist allowed parameter keys |
| `parseInt(req.params.id)` without NaN check — crashes on bad input | ALL routes with `/:id` | Add `isNaN()` guard, return 400 |

**S1-P2: Auth & Access Control**

| Issue | File | Fix |
|-------|------|-----|
| `GET /system/recovery-status` may lack auth | system.js | Verify/add `authMiddleware` |
| Stats routes — verify adminOnly placement | stats/*.js | Audit all stats routes for role enforcement |
| Role-based field filtering in responses | Various | Ensure sensitive fields (password_hash) never leak |

### Sprint 2 — Bugs Backend & Frontend

**S2-P1: Backend Bugs**

| Issue | File | Fix |
|-------|------|-----|
| Route ordering: `/dlc/alertes` matched by `/:id` first | products.js | Move `/dlc/alertes` BEFORE `/:id/variantes` |
| `backupInProgress` never reset on early return paths | db.js:158,200 | Add `finally` block or reset in all return paths |
| `getDb()` not awaited in health check | health.js:8,24 | Add `await` |
| Order number race condition (counter not atomic) | orders.js:42-43 | Use transaction or atomic counter |
| Synchronous bcrypt calls block event loop | auth.js, users.js | Replace with `bcrypt.compare()` async |

**S2-P2: Frontend Bugs**

| Issue | File | Fix |
|-------|------|-----|
| Service worker caches but never serves (self-destructing) | sw.js | Implement proper cache-first with network fallback |
| Global `window.*` assignments for inline onclick | js/core/*.js | Track and reduce, prepare for addEventListener migration |
| Event listener leaks on module switch | js/modules/*.js | Add cleanup/disposal pattern |

### Sprint 3 — Code Quality & Tests

**S3-P1: ESLint & Dead Code**

Fix all 11 ESLint warnings:

| File | Warning | Fix |
|------|---------|-----|
| facture.js:511-512 | `devise`, `fmt` unused | Remove or use |
| health.js:8 | `db` unused | Remove import |
| products.js:246 | `tId` unused | Remove |
| stats-export.js:157 | `utilisateur_id`, `categorie_id` unused | Remove |
| stock.js:62 | `type` unused | Remove |
| system.js:4,9 | `bcrypt`, `adminOnly` unused | Remove |
| taxes.js:3 | `adminOnly` unused | Remove |
| tests/*.js | Multiple unused vars | Clean up |

**S3-P2: Missing Tests**

- Add tests for untested routes (caisse, expenses, deliveries)
- Add edge case tests (invalid IDs, empty bodies, concurrent access)
- Add security regression tests

---

## 3. Chantier 2: Refactoring Architecture

### Sprint 4 — Backend Cleanup

**S4-P1: Shared Utilities**

- `server/utils/sanitize.js` — field whitelisting utility (reusable across all PUT routes)
- `server/utils/errors.js` — standardize error response format `{ success: false, error: "..." }` everywhere
- `server/utils/validators.js` — shared validation chains (ID param, pagination, etc.)

**S4-P2: Validation System**

Add express-validator middleware on missing routes:
- `POST /caisse/mouvements`
- `POST/PUT /livraisons`
- `PUT /clients/:id`
- `POST /clients/:id/credits`

Extract duplicated invoice code in `invoices.js` (lines 9-161 are ~95% identical between batch and single).

### Sprint 5 — Frontend Refactoring

**S5-P1: Inline onclick Migration**

- Map all ~250 inline onclick handlers
- Migrate to `addEventListener` with data-attributes
- Phased approach: POS module first (highest usage), then others
- Maintain backward compatibility during migration

**S5-P2: CSS Refactoring**

- Audit all ~100 hardcoded colors in `pos.css`
- Map to CSS custom properties in `:root` and `[data-theme="dark"]`
- Ensure all colors flow through the theme system
- Test both light and dark themes after each batch

### Sprint 6 — Config & Database

**S6-P1: Configuration Externalization**

Make configurable via `.env`:
- `BACKUP_INTERVAL_MS` (currently hardcoded in db.js)
- `RATE_LIMIT_MAX` (currently hardcoded 100)
- `UPLOAD_MAX_SIZE` (currently hardcoded)
- `SESSION_TIMEOUT_MS`

**S6-P2: Database Improvements**

- Review and add missing indexes for common query patterns
- Improve migration error handling (currently silent try/catch)
- Add PRAGMA optimization recommendations

---

## 4. Chantier 3: Optimisations & Production Readiness

### Sprint 7 — Performance & Monitoring

**S7-P1: Performance**

- Query profiling for slow endpoints
- Response compression tuning
- Static asset optimization (cache headers already done in Sprint 6)
- Lazy loading verification

**S7-P2: Monitoring**

- Structured logging improvements (request ID correlation)
- Health check enhancement (DB connectivity, memory usage)
- Error rate tracking

### Sprint 8 — Testing & Documentation

**S8-P1: Testing Push**

- Target 80% code coverage
- Integration tests for critical flows (order → payment → stock → invoice)
- Regression test suite for security fixes
- Load test baseline

**S8-P2: Documentation**

- Updated API documentation
- Deployment guide
- Architecture decision records for key choices

### Sprint 9 — Final Validation

**S9-P1: Packaging Prep**

- Installer requirements document
- Licensing architecture design
- Auto-update strategy

**S9-P2: Final Validation**

- Full regression test run
- Security scan (npm audit)
- Performance benchmark
- Release notes generation

---

## 5. Dependencies Between Chantiers

```
Chantier 1 (Audit & Fixes) ───────► Chantier 2 (Refactoring) ───────► Chantier 3 (Optimization)
  Sprint 1: Security                  Sprint 4: Backend cleanup          Sprint 7: Performance
  Sprint 2: Bugs                      Sprint 5: Frontend refactor         Sprint 8: Testing & docs
  Sprint 3: Quality & tests           Sprint 6: Config & DB              Sprint 9: Final validation
```

Each chantier builds on the previous one's clean foundation.

---

## 6. Definition of Done

| Criterion | Tool | Target |
|-----------|------|--------|
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Tests | `npm test` | 100% pass, ≥80% coverage |
| Security | Manual review | No SQL injection, no mass assignment, auth everywhere |
| Performance | Response time | P95 < 200ms |
| CSS | Visual check | Both themes work, no hardcoded colors |
| Frontend | Manual check | No inline onclick, no global pollution |

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Frontend onclick migration breaks UI | Phased approach, test each module |
| CSS refactoring breaks themes | Visual regression testing after each batch |
| Performance regression from refactoring | Benchmark before/after each sprint |
| Test failures during refactoring | Fix tests as part of each sprint |

---

*Design spec v1.0 — 19 August 2026*
