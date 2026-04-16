# Gradual Lint Enforcement Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gradual ESLint setup that enforces code-quality and TypeScript strictness rules for new or changed code without breaking the whole legacy tree.

**Architecture:** Introduce an explicit ESLint configuration on top of the current Next.js baseline, add focused fixtures to validate the strict policy, and expose progressive scripts for strict and changed-file linting.

**Tech Stack:** ESLint, Next.js, TypeScript, Node.js scripts, npm

---

## Chunk 1: Policy Validation

### Task 1: Add lint fixtures and a failing validation command

**Files:**
- Create: `tests/lint-fixtures/strict-pass.ts`
- Create: `tests/lint-fixtures/strict-fail.ts`

- [ ] **Step 1: Write the failing fixtures**

Create:

- one fixture that should pass the strict lint
- one fixture that should fail on function size, complexity, or unnecessary condition patterns

- [ ] **Step 2: Run validation to verify it fails**

Run: `npx eslint tests/lint-fixtures/strict-fail.ts`
Expected: FAIL because the explicit ESLint config and required plugins do not exist yet

- [ ] **Step 3: Add minimal implementation**

Introduce the config and dependencies needed for the validation command to become meaningful.

- [ ] **Step 4: Re-run validation**

Run: `npx eslint tests/lint-fixtures/strict-fail.ts`
Expected: FAIL for the intended lint violations rather than setup errors

## Chunk 2: Project Integration

### Task 2: Add explicit ESLint configuration and scripts

**Files:**
- Modify: `package.json`
- Create: `.eslintrc.json` or `eslint.config.*`
- Create: `scripts/lint-changed.mjs`

- [ ] **Step 1: Add strict scripts**

Add:

- `lint`
- `lint:strict`
- `lint:changed`

- [ ] **Step 2: Install dependencies**

Add the minimum TypeScript ESLint packages needed for the new config.

- [ ] **Step 3: Implement the gradual rollout logic**

Make `lint:changed`:

- diff against `main`
- keep only `.ts` and `.tsx` files
- lint only those files
- exit successfully with a clear message when there are no matching files

- [ ] **Step 4: Run targeted verification**

Run:

- `npm run lint:strict -- tests/lint-fixtures/strict-pass.ts`
- `npm run lint:strict -- tests/lint-fixtures/strict-fail.ts`

Expected:

- pass fixture succeeds
- fail fixture fails with meaningful rule output

## Chunk 3: Documentation and Verification

### Task 3: Document the rollout

**Files:**
- Create: `docs/code-quality-rules.md`

- [ ] **Step 1: Document enforced vs. guideline rules**

Explain:

- what is enforced automatically now
- what remains a human guideline for the moment
- how future AGENTS.md guidance can point to these scripts and rules

- [ ] **Step 2: Run full verification**

Run:

- `npm run lint:strict -- tests/lint-fixtures/strict-pass.ts`
- `npm run lint:changed`
- `npm test`

Expected:

- strict lint works
- changed-file lint handles the current branch state cleanly
- existing test suite still passes
