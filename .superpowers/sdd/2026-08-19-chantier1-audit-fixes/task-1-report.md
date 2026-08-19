# Task 1: Create shared field-whitelist utility

**Status:** DONE  
**Commit:** `61fa6da` — feat: add filterFields utility for safe PUT updates  
**Date:** 2026-08-19

## What was done

- Created `server/utils/sanitize.js` with `filterFields(obj, allowedKeys)` that returns a new object containing only allowed keys, stripping null/undefined/missing values.
- Created `server/tests/sanitize.test.js` with 4 tests covering: key filtering, empty result on no match, null/undefined input, and undefined value stripping.
- All 149 tests pass (4 new + 145 existing) with zero regressions.

## Test summary

`filterFields` — 4/4 passing: key filtering, no-match, null/undefined input, undefined stripping.
