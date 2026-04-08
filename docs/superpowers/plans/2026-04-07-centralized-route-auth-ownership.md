# Centralized Route Auth and Ownership Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared route auth wrapper and ownership assertion, then migrate the current ownership-sensitive meeting and task routes to use it.

**Architecture:** Introduce a single route helper module that owns request auth resolution, ownership checks, and handler wrapping. Then migrate targeted routes incrementally, starting with tests that lock down helper behavior and at least one route regression.

**Tech Stack:** Next.js route handlers, Supabase SSR client, Supabase service-role client, TypeScript, Vitest

---

## Chunk 1: Helper Foundation

### Task 1: Add helper tests

**Files:**
- Create: `src/lib/api/auth.test.ts`
- Test: `src/lib/api/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:

- `withAuth()` returns `401` when `auth.getUser()` has no user
- `withAuth()` injects the auth context into the wrapped handler
- `requireOwnership()` returns normally when `user_id` matches
- `requireOwnership()` throws `403` when the row is missing
- `requireOwnership()` throws `403` when the row belongs to another user

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: FAIL because the helper module does not exist yet

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/api/auth.ts` with:

- an auth context type
- `requireAuth()`
- `requireOwnership()`
- `withAuth()`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: PASS

## Chunk 2: Route Migration

### Task 2: Migrate task route

**Files:**
- Modify: `src/app/api/tasks/[id]/route.ts`
- Test: `src/lib/api/auth.test.ts`

- [ ] **Step 1: Add a route regression test if helper coverage is insufficient**

Lock the expected ownership behavior for the migrated route.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: FAIL on the new route behavior assertion

- [ ] **Step 3: Migrate the route**

Refactor `PATCH` and `DELETE` to:

- use `withAuth()`
- call `requireOwnership(auth.supabaseAdmin, "tasks", id, auth.user.id)`
- keep the existing request-body and success payload behavior

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: PASS

### Task 3: Migrate meeting ownership routes

**Files:**
- Modify: `src/app/api/meetings/[id]/route.ts`
- Modify: `src/app/api/meetings/[id]/retry/route.ts`
- Modify: `src/app/api/meetings/[id]/status/route.ts`
- Modify: `src/app/api/meetings/[id]/resend/route.ts`

- [ ] **Step 1: Write or extend tests where behavior changes**

Add coverage for any meeting-route behavior that is not already protected by helper tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: FAIL on the new expectation

- [ ] **Step 3: Migrate the routes**

Refactor each route to:

- use `withAuth()`
- call `requireOwnership(auth.supabaseAdmin, "meetings", params.id, auth.user.id)` before business logic
- preserve its current validation and response payloads

- [ ] **Step 4: Run targeted tests**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: PASS

## Chunk 3: Verification

### Task 4: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused helper tests**

Run: `npm test -- src/lib/api/auth.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with no regressions

- [ ] **Step 3: Review diff for accidental behavior changes**

Inspect the final diff to confirm:

- no route lost validation behavior
- ownership failures now consistently return `403`
- `src/app/api/meetings/[id]/route.ts` is included in the migration
