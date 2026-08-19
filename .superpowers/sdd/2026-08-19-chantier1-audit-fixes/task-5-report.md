# Task 5: Fix backupInProgress flag reset on error paths

## Status: DONE

## Summary

Refactored `createBackup` and `createArchiveBackup` in `server/db.js` from `.then()/.catch()` promise chains to `async/await` with `try/finally` blocks.

## What changed

**`server/db.js:156-181` — `createBackup`**
- Converted from `function` returning `Promise.resolve()` to `async function`
- Wrapped all logic (including pre-promise sync code like `fs.mkdirSync`) in `try`
- Moved `backupInProgress = false` to `finally` block, guaranteeing reset regardless of failure path

**`server/db.js:198-224` — `createArchiveBackup`**
- Same refactoring pattern as `createBackup`

## Bug fixed

Previously, if `fs.mkdirSync(BACKUP_DIR, ...)` or any other synchronous code between `backupInProgress = true` and the `.then()/.catch()` chain threw an exception, the flag would remain `true` permanently, blocking all future backups.

## Why async/await

- Both functions are already called with `await` in `server/routes/system.js:177,184`
- The timer at `server/db.js:66` (`if (!backupInProgress) {createBackup();}`) already ignores the return value
- `async` functions return promises natively, so callers are unaffected

## Verification

- All 149 tests pass (10 suites)
- Commit: `b888179` — `fix: reset backupInProgress flag in finally block`

## Concerns

None. The fix is minimal and idiomatic. The `backupInProgress` flag was already being reset in both `.then()` and `.catch()` in the old code, but the synchronous gap was a real latent bug.
