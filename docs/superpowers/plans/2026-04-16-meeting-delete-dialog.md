# Meeting Delete Dialog Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-first, reusable meeting deletion flow with confirmation, summary copy affordance, idempotent backend deletion, and R2 cleanup.

**Architecture:** The meeting detail page remains UI-only and calls its companion helper. The route handler adds `DELETE` and delegates the destructive work to `@/lib/meetings/delete`, where ownership, idempotency, and R2 cleanup are centralized. The confirmation UI uses shadcn `Dialog` and reusable `Button` primitives.

**Tech Stack:** Next.js App Router, Vitest, shadcn/ui, Tailwind, Supabase, Cloudflare R2.

---

## Chunk 1: Backend deletion contract

### Task 1: Add failing tests for idempotent meeting deletion

**Files:**
- Modify: `src/app/api/meetings/[id]/route.test.ts`
- Create: `src/lib/meetings/delete.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run tests to verify they fail**
  Run: `npm run test -- src/app/api/meetings/[id]/route.test.ts src/lib/meetings/delete.test.ts`
- [ ] **Step 3: Implement minimal deletion helper and route support**
- [ ] **Step 4: Re-run backend tests and make them pass**
- [ ] **Step 5: Commit backend chunk**

### Task 2: Implement reusable backend deletion logic

**Files:**
- Create: `src/lib/meetings/delete.ts`
- Modify: `src/app/api/meetings/[id]/route.ts`
- Modify: `src/lib/r2.ts` only if a missing-object helper is required

- [ ] **Step 1: Load the owned meeting and audio key**
- [ ] **Step 2: Make R2 delete tolerant to a missing object**
- [ ] **Step 3: Delete the meeting row**
- [ ] **Step 4: Return an idempotent success payload**
- [ ] **Step 5: Re-run backend tests**

## Chunk 2: Companion API helper

### Task 3: Add failing tests for meeting deletion from the page helper

**Files:**
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.test.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.ts`

- [ ] **Step 1: Write failing test for `deleteMeetingById`**
- [ ] **Step 2: Run helper tests to verify failure**
  Run: `npm run test -- src/app/dashboard/meetings/[id]/meeting-api.test.ts`
- [ ] **Step 3: Implement the helper with normalized errors**
- [ ] **Step 4: Re-run helper tests**
- [ ] **Step 5: Commit helper chunk**

## Chunk 3: Detail page UI

### Task 4: Add reusable delete dialog and wire it into the detail page

**Files:**
- Create: `src/components/meeting-detail/MeetingDeleteDialog.tsx`
- Modify: `src/components/meeting-detail/MeetingHeader.tsx`
- Modify: `src/components/meeting-detail/index.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-detail-client.tsx`

- [ ] **Step 1: Add the dialog component with mobile-first layout**
- [ ] **Step 2: Add copy-summary affordance and confirmation input**
- [ ] **Step 3: Add delete action to the header**
- [ ] **Step 4: Call `deleteMeetingById`, toast, and redirect on success**
- [ ] **Step 5: Run focused tests and build confidence**

## Chunk 4: Verification

### Task 5: Run final verification

**Files:**
- No file changes expected

- [ ] **Step 1: Run all focused tests**
  Run: `npm run test -- src/app/api/meetings/[id]/route.test.ts src/lib/meetings/delete.test.ts src/app/dashboard/meetings/[id]/meeting-api.test.ts`
- [ ] **Step 2: Review diff for architecture compliance**
- [ ] **Step 3: Summarize behavior changes and residual risks**
