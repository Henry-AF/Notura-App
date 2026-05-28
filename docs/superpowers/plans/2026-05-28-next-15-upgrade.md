# Next 15 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Notura from `next@14.2.35` to `next@15.5.18` while preserving current React 18 behavior and keeping the app ready for a later PostHog wizard run.

**Architecture:** Keep the migration narrow: update only framework packages first, let tests/build expose real compatibility breaks, then patch the smallest affected surfaces. Expected code changes are around Next 15 async request APIs (`cookies()`, route `params`, page `params`) and any type fallout from those changes.

**Tech Stack:** Next.js App Router, React 18, TypeScript, npm, Vitest, ESLint, Sentry, Supabase SSR.

---

## Chunk 1: Baseline And Dependency Upgrade

### File Structure

- Modify: `package.json`
  - Update `dependencies.next` from `14.2.35` to `15.5.18`.
  - Update `devDependencies.eslint-config-next` from `14.2.35` to `15.5.18`.
  - Keep `react`, `react-dom`, `@types/react`, and `@types/react-dom` unchanged in this migration.
  - Keep `scripts.build` as `next build`; do not enable Turbopack.

- Modify: `package-lock.json`
  - Let `npm install` update this file.

- Do not modify yet:
  - `src/lib/supabase/server.ts`
  - `src/lib/api/auth.ts`
  - dynamic route handlers under `src/app/api/**/[id]/route.ts`
  - dynamic pages under `src/app/dashboard/meetings/[id]/**`

The first pass should update dependencies only. Code changes happen only after fresh failures prove what Next 15 requires in this codebase.

### Task 1: Record The Current Baseline

**Files:**
- Read-only verification only.

- [ ] **Step 1: Confirm clean worktree**

Run:

```bash
git status --short
```

Expected: no unrelated modified files. If there are user changes, do not revert them; note them and avoid touching those files unless required.

- [ ] **Step 2: Run the existing test suite**

Run:

```bash
npm test
```

Expected: PASS. If it fails before the upgrade, stop and investigate the pre-existing failure before changing dependencies.

- [ ] **Step 3: Run strict lint**

Run:

```bash
npm run lint:strict
```

Expected: PASS. If it fails before the upgrade, stop and investigate the pre-existing failure before changing dependencies.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. If it fails before the upgrade, stop and investigate the pre-existing failure before changing dependencies.

### Task 2: Update Next Packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update package versions**

Edit `package.json`:

```json
"next": "15.5.18"
```

```json
"eslint-config-next": "15.5.18"
```

Expected: no React package changes.

- [ ] **Step 2: Install dependency graph**

Run:

```bash
npm install
```

Expected: `package-lock.json` updates cleanly and npm exits with code 0.

- [ ] **Step 3: Inspect dependency diff**

Run:

```bash
git diff -- package.json package-lock.json
```

Expected:

- `next` is `15.5.18`
- `eslint-config-next` is `15.5.18`
- React remains `^18`
- no unexpected app dependency churn beyond transitive lockfile updates

- [ ] **Step 4: Commit dependency upgrade checkpoint**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade next to 15.5.18"
```

Expected: commit succeeds.

---

## Chunk 2: Compatibility Fixes

### File Structure

Expected files, depending on the failures observed:

- Modify: `src/lib/supabase/server.ts`
  - If Next 15 reports `cookies()` must be awaited, make `createServerSupabase` async and await `cookies()`.

- Modify: `src/lib/api/auth.ts`
  - If `createServerSupabase` becomes async, await it in `requireAuth`.

- Modify: route handlers under `src/app/api/**/[id]/route.ts`
  - Only if Next 15 type/build errors prove dynamic route `params` must be awaited or typed differently.
  - Preserve `withAuth` and `requireOwnership`.

- Modify: `src/lib/api/auth.test.ts` and route tests only if helper signatures change.
  - Tests should assert the existing auth behavior, not new product behavior.

- Modify: `src/app/dashboard/meetings/[id]/page.tsx`
  - Only if Next 15 type/build errors require async `params`.

- Modify: `src/app/dashboard/meetings/[id]/edit/page.tsx`
  - Only if Next 15 type/build errors require async `params`.

### Task 3: Produce The First Post-Upgrade Failure

**Files:**
- Read-only verification first.

- [ ] **Step 1: Run tests after dependency upgrade**

Run:

```bash
npm test
```

Expected: either PASS or FAIL with actionable compatibility errors. If it fails, capture the first root cause and fix that before moving to the next error.

- [ ] **Step 2: Run strict lint after dependency upgrade**

Run:

```bash
npm run lint:strict
```

Expected: either PASS or FAIL with actionable type/lint errors. If it fails, capture the first root cause and fix that before moving to the next error.

- [ ] **Step 3: Run build after dependency upgrade**

Run:

```bash
npm run build
```

Expected: likely FAIL if Next 15 async request APIs affect this app. Treat this as the failing test for framework compatibility. Do not make broad preemptive edits before seeing the failure.

### Task 4: Fix Supabase SSR Cookie Compatibility If Required

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/api/auth.ts`
- Test: `src/lib/api/auth.test.ts`
- Possibly Test: route tests that mock `withAuth`

- [ ] **Step 1: Verify the failing symptom**

Only start this task if test/build output points to `cookies()` from `next/headers`, `createServerSupabase`, or `requireAuth`.

Expected failure examples:

- `Property 'getAll' does not exist on type 'Promise<...>'`
- Next warning/error that `cookies()` should be awaited
- Type error from assigning async client creation to sync helper usage

- [ ] **Step 2: Write or adjust failing test only if current tests do not fail**

If `npm test` does not already fail for the helper signature but the build does, add a focused test in `src/lib/api/auth.test.ts` that awaits `requireAuth` and verifies it still returns:

```typescript
expect(auth.user.id).toBe("user-id");
expect(auth.supabaseAdmin).toBeDefined();
```

Run:

```bash
npm test -- src/lib/api/auth.test.ts
```

Expected: FAIL before implementation if a test adjustment was needed. If the existing test/build already fails, use that failure instead.

- [ ] **Step 3: Implement minimal async cookie fix**

In `src/lib/supabase/server.ts`, change `createServerSupabase` only as much as needed:

```typescript
export async function createServerSupabase() {
  const cookieStore = await cookies();
  // existing createServerClient body remains otherwise unchanged
}
```

In `src/lib/api/auth.ts`, update the `RouteAuthContext` type and `requireAuth` call site as needed:

```typescript
const supabase = await createServerSupabase();
```

Expected: auth behavior remains unchanged.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/lib/api/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run route tests that cover `withAuth` if touched**

Run:

```bash
npm test -- src/app/api/api-rate-limit-critical-routes.test.ts 'src/app/api/meetings/[id]/route.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit compatibility fix**

Run:

```bash
git add src/lib/supabase/server.ts src/lib/api/auth.ts src/lib/api/auth.test.ts
git commit -m "fix: adapt supabase server auth to next 15"
```

Expected: commit succeeds. If no test file changed, omit it from `git add`.

### Task 5: Fix Dynamic Params Compatibility If Required

**Files:**
- Modify only files named by Next 15 build/type errors.
- Likely candidates:
  - `src/app/api/meetings/[id]/route.ts`
  - `src/app/api/meetings/[id]/group/route.ts`
  - `src/app/api/meetings/[id]/status/route.ts`
  - `src/app/api/meetings/[id]/retry/route.ts`
  - `src/app/api/meetings/[id]/cancel-processing/route.ts`
  - `src/app/api/meetings/[id]/resend/route.ts`
  - `src/app/api/meetings/[id]/export/route.ts`
  - `src/app/api/tasks/[id]/route.ts`
  - `src/app/api/meeting-groups/[id]/route.ts`
  - `src/app/api/meeting-chats/[chatId]/route.ts`
  - `src/app/api/meetings/[id]/chats/route.ts`
  - `src/app/api/meetings/[id]/chats/[chatId]/route.ts`
  - `src/app/dashboard/meetings/[id]/page.tsx`
  - `src/app/dashboard/meetings/[id]/edit/page.tsx`
- Test corresponding `*.test.ts` files if signatures change.

- [ ] **Step 1: Verify the failing symptom**

Only start this task if `npm run build` or TypeScript reports dynamic `params` incompatibility.

Expected failure examples:

- `Type '{ id: string; }' is missing the following properties from type 'Promise<...>'`
- Next route handler context type errors involving `params`
- page prop errors involving `params`

- [ ] **Step 2: Fix one file at a time**

For page components, use the Next 15 async params shape if required:

```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // use id below
}
```

For route handlers wrapped by `withAuth`, prefer adjusting the shared route context type in `src/lib/api/auth.ts` if errors show the wrapper contract is stale. Avoid duplicating custom context types in every route unless the shared abstraction cannot represent Next 15 correctly.

Expected: authorization and ownership checks remain in the same order.

- [ ] **Step 3: Run the focused test for the touched route/page helper**

Examples:

```bash
npm test -- 'src/app/api/meetings/[id]/route.test.ts'
```

```bash
npm test -- 'src/app/api/meeting-groups/[id]/route.test.ts'
```

Expected: PASS for each touched route test.

- [ ] **Step 4: Re-run build to discover the next params file**

Run:

```bash
npm run build
```

Expected: either PASS or next specific params error. Repeat Steps 2-4 until no dynamic params errors remain.

- [ ] **Step 5: Commit dynamic params fixes**

Run:

```bash
git status --short
git add src/lib/api/auth.ts \
  'src/app/api/meetings/[id]/route.ts' \
  'src/app/api/meetings/[id]/route.test.ts' \
  'src/app/api/meetings/[id]/group/route.ts' \
  'src/app/api/meetings/[id]/status/route.ts' \
  'src/app/api/meetings/[id]/status/route.test.ts' \
  'src/app/api/meetings/[id]/retry/route.ts' \
  'src/app/api/meetings/[id]/retry/route.test.ts' \
  'src/app/api/meetings/[id]/cancel-processing/route.ts' \
  'src/app/api/meetings/[id]/cancel-processing/route.test.ts' \
  'src/app/api/meetings/[id]/resend/route.ts' \
  'src/app/api/meetings/[id]/resend/route.test.ts' \
  'src/app/api/meetings/[id]/export/route.ts' \
  'src/app/api/tasks/[id]/route.ts' \
  'src/app/api/meeting-groups/[id]/route.ts' \
  'src/app/api/meeting-chats/[chatId]/route.ts' \
  'src/app/api/meeting-chats/[chatId]/route.test.ts' \
  'src/app/api/meetings/[id]/chats/route.ts' \
  'src/app/api/meetings/[id]/chats/route.test.ts' \
  'src/app/api/meetings/[id]/chats/[chatId]/route.ts' \
  'src/app/api/meetings/[id]/chats/[chatId]/route.test.ts' \
  'src/app/dashboard/meetings/[id]/page.tsx' \
  'src/app/dashboard/meetings/[id]/edit/page.tsx'
git commit -m "fix: adapt dynamic params to next 15"
```

Expected: commit succeeds. Before committing, run `git diff --cached --name-only` and unstage any file that was not actually changed for this task; do not stage all of `src/app`.

---

## Chunk 3: Verification And Handoff

### File Structure

- No planned production file changes.
- Possible documentation update only if observed migration notes differ materially from this plan.

### Task 6: Full Verification

**Files:**
- Verification only.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run strict lint**

Run:

```bash
npm run lint:strict
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Optionally check legacy lint script**

Run:

```bash
npm run lint
```

Expected: PASS if `next lint` still works under Next 15. If it fails because of framework lint tooling deprecation or config behavior, document it separately and do not block the upgrade if `lint:strict` passes.

### Task 7: Final Review

**Files:**
- Review only.

- [ ] **Step 1: Inspect final diff**

Run:

```bash
git log --oneline -5
git log --stat --oneline -4
git diff --stat
```

Expected:

- dependency diff is limited to Next-related lockfile changes
- no React 19 upgrade
- no PostHog installation
- no Turbopack build script
- no unrelated UI/product changes

- [ ] **Step 2: Confirm final status**

Run:

```bash
git status --short
```

Expected: clean worktree or only intentional uncommitted notes.

- [ ] **Step 3: Summarize migration**

Prepare final notes with:

- target version: `next@15.5.18`
- verification commands and results
- files changed
- any skipped optional check, with reason
- reminder that PostHog wizard is next and must compose with existing Sentry instrumentation

### Task 8: PostHog Readiness Note

**Files:**
- No changes unless requested separately.

- [ ] **Step 1: Confirm instrumentation files still exist**

Run:

```bash
ls src/instrumentation-client.ts src/instrumentation.ts
```

Expected: both files exist.

- [ ] **Step 2: Confirm Sentry exports remain intact**

Run:

```bash
rg "Sentry.init|onRouterTransitionStart|onRequestError" src/instrumentation-client.ts src/instrumentation.ts
```

Expected:

- `Sentry.init` still exists in `src/instrumentation-client.ts`
- `onRouterTransitionStart` still exports `Sentry.captureRouterTransitionStart`
- `onRequestError` still exports `Sentry.captureRequestError`

This confirms the next PostHog step should compose analytics initialization with Sentry instead of replacing these files.
