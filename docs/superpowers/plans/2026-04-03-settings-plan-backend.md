# Settings Plan Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mocked "Plano" card in dashboard settings with real backend billing data while preserving the current interactive settings UI and ignoring the "Gerenciar plano" button action.

**Architecture:** Keep data loading on the server by converting the settings page into an async server wrapper, then move the existing interactive UI into a client component. Isolate plan-card presentation rules in a pure helper so backend values are mapped to UI labels in one small, testable place.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Supabase SSR, existing UI components, minimal unit-test runner for presenter logic

---

## File Structure

- Modify: `package.json`
  Add the minimum scripts and dev dependencies needed for focused unit tests.
- Create: `vitest.config.ts`
  Minimal test-runner config for TypeScript unit tests.
- Create: `src/app/dashboard/settings/plan-presenter.ts`
  Pure transformation from backend billing state to plan-card UI props.
- Create: `src/app/dashboard/settings/plan-presenter.test.ts`
  Focused unit tests for plan display behavior.
- Modify: `src/app/dashboard/settings/page.tsx`
  Convert from client page to async server wrapper that loads auth, profile, and billing data.
- Create: `src/app/dashboard/settings/settings-client.tsx`
  Hold the existing interactive settings UI and consume initial props from the server page.

## Chunk 1: Test Harness And Presenter

### Task 1: Add The Minimal Test Harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write the failing test configuration references**

Add a `test` script in `package.json` that points to Vitest before the dependency or config exists.

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Run test command to verify it fails**

Run: `npm test`
Expected: FAIL because `vitest` is not installed or configured yet

- [ ] **Step 3: Add the minimal test runner setup**

Update `package.json` with:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "...",
    "vite-tsconfig-paths": "..."
  }
}
```

Create `vitest.config.ts` with a minimal node environment and tsconfig-path support.

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Run test command to verify the harness works**

Run: `npm test`
Expected: PASS with `0` test files or FAIL only because no tests exist yet, proving the runner starts correctly

### Task 2: Add Failing Tests For Plan Presentation

**Files:**
- Create: `src/app/dashboard/settings/plan-presenter.test.ts`
- Test: `src/app/dashboard/settings/plan-presenter.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that describe the expected presenter output for:

```ts
it("maps free plan usage and price", () => {});
it("maps pro plan usage and price", () => {});
it("falls back safely for unknown plan values", () => {});
it("renders unlimited usage without progress bar", () => {});
it("clamps progress at one hundred percent", () => {});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: FAIL because `plan-presenter.ts` does not exist yet

- [ ] **Step 3: Write the minimal presenter implementation**

Create `src/app/dashboard/settings/plan-presenter.ts` with:

```ts
export interface PlanPresentation {
  title: string;
  badgeLabel: string;
  priceLabel: string | null;
  usageLabel: string;
  usageValueLabel: string | null;
  showProgress: boolean;
  progressValue: number | null;
}

export function presentPlanCard(...) {
  // minimal mapping logic only
}
```

Include only the logic needed for the approved spec:
- explicit mapping for `free`
- explicit mapping for `pro`
- neutral fallback for legacy or unknown values
- unlimited handling when `monthlyLimit` is `null`
- percentage clamp between `0` and `100`

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: PASS

### Task 3: Refine The Presenter Output Shape For UI Consumption

**Files:**
- Modify: `src/app/dashboard/settings/plan-presenter.ts`
- Modify: `src/app/dashboard/settings/plan-presenter.test.ts`

- [ ] **Step 1: Write one failing test for any missing UI-facing field**

If the UI needs an extra field such as a leading avatar letter or secondary label, add a single failing test that proves it.

```ts
it("exposes the visual label needed by the plan card", () => {});
```

- [ ] **Step 2: Run the focused test to verify it fails for the expected reason**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: FAIL on the new missing field only

- [ ] **Step 3: Add the minimal presenter change**

Extend the presenter output only if the existing card markup truly needs it.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: PASS

## Chunk 2: Server Data Loading And UI Wiring

### Task 4: Move The Settings UI Into A Client Component

**Files:**
- Create: `src/app/dashboard/settings/settings-client.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Write the failing test equivalent as a compile target**

Before moving logic, define the prop types in `settings-client.tsx` so `page.tsx` can no longer satisfy the previous default export shape until the split is complete.

```ts
export interface SettingsClientProps {
  initialProfile: { ... };
  initialPlan: { ... };
}
```

- [ ] **Step 2: Run lint to verify the incomplete split fails**

Run: `npm run lint`
Expected: FAIL with import, type, or component-shape errors caused by the unfinished split

- [ ] **Step 3: Move the existing interactive UI into `settings-client.tsx`**

Keep:
- current `useState` usage for unsaved profile inputs
- current `useState` usage for WhatsApp testing and notifications
- current settings layout and styling

Remove only the mocked plan constants from the client component.

- [ ] **Step 4: Run lint to verify the client split is green**

Run: `npm run lint`
Expected: PASS for the extracted client component or show only remaining errors in `page.tsx`

### Task 5: Convert The Page Into A Server Wrapper

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Write the failing server integration shape**

Update `page.tsx` to import `settings-client.tsx`, `createServerSupabase`, `getBillingStatus`, and `redirect` before implementing the full data-loading path.

```ts
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getBillingStatus } from "@/lib/billing";
import { SettingsClient } from "./settings-client";
```

- [ ] **Step 2: Run lint to verify it fails while data loading is incomplete**

Run: `npm run lint`
Expected: FAIL because the new imports or props are not wired yet

- [ ] **Step 3: Implement the minimal server data loading**

Implement:
- authenticated user lookup with `createServerSupabase().auth.getUser()`
- `redirect("/login")` when there is no user
- tolerant profile lookup with `.maybeSingle()`
- billing lookup with `getBillingStatus(user.id)`
- prop assembly for `SettingsClient`

Keep responsibilities narrow: this file should only fetch data and render the client component.

- [ ] **Step 4: Run lint to verify the server wrapper passes**

Run: `npm run lint`
Expected: PASS

### Task 6: Wire The Presenter Into The Plan Card

**Files:**
- Modify: `src/app/dashboard/settings/settings-client.tsx`
- Modify: `src/app/dashboard/settings/plan-presenter.ts`

- [ ] **Step 1: Write one failing test or assertion for the final UI contract**

If needed, add a failing presenter test covering the exact value shape the card consumes, such as `priceLabel` being `null` for unknown plans.

```ts
it("returns null price for unknown plans", () => {});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: FAIL for the new contract only

- [ ] **Step 3: Update the client component to consume real plan props**

Replace the mocked constants:

```ts
const planName = "Pro";
const meetingsUsed = 12;
const meetingsLimit = 30;
const usagePercent = ...
```

with presenter output derived from server-provided billing state.

Keep the existing button rendered and inert.

- [ ] **Step 4: Run the focused presenter test and lint**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: PASS

Run: `npm run lint`
Expected: PASS

## Chunk 3: Final Verification

### Task 7: Run Fresh Verification Before Claiming Completion

**Files:**
- Verify only

- [ ] **Step 1: Run the focused unit test suite**

Run: `npm test -- src/app/dashboard/settings/plan-presenter.test.ts`
Expected: PASS

- [ ] **Step 2: Run the full lint command**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Run the build if it is a meaningful signal**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Summarize any residual risk honestly**

Document any remaining gap, especially:
- no persistence added for the other settings sections
- unknown plans still render through neutral fallback
- future `platinum` display metadata is not part of this task
