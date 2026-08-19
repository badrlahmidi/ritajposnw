# Task 4: Fix sync bcrypt calls → async

## Summary

Converted all synchronous bcrypt calls in `server/routes/auth.js` and `server/routes/users.js` to async equivalents to prevent event loop blocking.

## Changes Made

### `server/routes/auth.js`
- **Line 21**: Added `async` to the `/login` route handler signature
- **Line 31**: `bcrypt.compareSync(password, user.password_hash)` → `await bcrypt.compare(password, user.password_hash)`

### `server/routes/users.js`
- **Line 13**: Added `async` to the `POST /` route handler (create user)
- **Line 15**: `bcrypt.hashSync(password, 10)` → `await bcrypt.hash(password, 10)`
- **Line 49**: `bcrypt.hashSync(password, 10)` → `await bcrypt.hash(password, 10)` (in PUT handler — already async)

### No `hashPassword` utility
Confirmed no `hashPassword` utility exists in `server/utils/`. All bcrypt usage was inline in the route files.

## Verification

- **Tests**: 149 passed, 0 failed (10 suites)
- **ESLint**: No errors on `routes/auth.js` or `routes/users.js`
