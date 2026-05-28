# Next 15 Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Next 15.5.18 and React 18.3 while aligning production runtime, reducing build/lint warnings, and resolving practical dependency risk.

**Architecture:** Treat this as a hardening pass, not a framework migration. Runtime metadata and CI should point to an LTS Node line, build warnings should be fixed at their source, and dependency upgrades should be scoped to low-risk or well-covered packages first.

**Tech Stack:** Next.js 15.5.18, React 18.3, npm, Vitest, ESLint, GitHub Actions, Vercel.

---

## Chunk 1: Runtime And Build Policy

### Task 1: Encode Node LTS And Build Script Policy

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `vercel.json`
- Create: `.nvmrc`
- Create: `.node-version`
- Create: `tests/runtime-build-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**
  - Assert `package.json` declares Node 24 in `engines.node`.
  - Assert `lint` no longer uses `next lint`.
  - Assert CI uses Node 24 in both jobs.
  - Assert `vercel.json` declares Node 24 via `build.env.NODE_VERSION`.
  - Assert `.nvmrc` and `.node-version` both contain `24`.

- [ ] **Step 2: Run policy tests and verify they fail**
  - Run: `npm test tests/runtime-build-policy.test.ts`
  - Expected: fail on missing Node 24 policy and deprecated lint script.

- [ ] **Step 3: Implement runtime/build policy**
  - Add Node 24 metadata and local version files.
  - Update GitHub Actions from Node 20 to Node 24.
  - Replace `next lint` with `eslint --config .eslintrc.json`.

- [ ] **Step 4: Verify policy tests pass**
  - Run: `npm test tests/runtime-build-policy.test.ts`

## Chunk 2: Build Warning Cleanup

### Task 2: Remove Known Next Build Warnings

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/ui/silk.tsx`
- Modify: `next.config.mjs`
- Create: `tests/build-warning-policy.test.ts`

- [ ] **Step 1: Write failing build-warning tests**
  - Assert layout does not include manual Google Fonts stylesheet links.
  - Assert `next.config.mjs` configures `outputFileTracingRoot`.
  - Assert `Silk` has no empty dependency array while reading render props.

- [ ] **Step 2: Run tests and verify they fail**
  - Run: `npm test tests/build-warning-policy.test.ts`

- [ ] **Step 3: Implement fixes**
  - Remove unused Material Symbols Google stylesheet link.
  - Add `outputFileTracingRoot` to `next.config.mjs`.
  - Fix `Silk` effect dependencies without changing visual behavior.

- [ ] **Step 4: Verify tests pass**
  - Run: `npm test tests/build-warning-policy.test.ts`

## Chunk 3: Viable Dependency Risk Reduction

### Task 3: Update Low-Risk Direct And Transitive Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Collect npm audit evidence**
  - Run: `npm audit --json`
  - Categorize direct dependencies vs transitive fixes.

- [ ] **Step 2: Apply safe upgrades first**
  - Update unused vulnerable direct packages where no app imports exist.
  - Update dev tooling if tests remain compatible.
  - Use `npm audit fix` only for non-breaking lockfile-safe fixes.

- [ ] **Step 3: Defer risky migrations with evidence**
  - Do not migrate `@google/generative-ai` to `@google/genai` unless tests and SDK surface prove it is small enough for this branch.
  - Document remaining non-viable items in final output.

- [ ] **Step 4: Verify dependency state**
  - Run: `npm audit --json`
  - Run: `npm test`
  - Run: `npm run build`

## Chunk 4: Final Verification

### Task 4: Full Verification

**Files:**
- No extra files expected.

- [ ] **Step 1: Run tests**
  - Run: `npm test`

- [ ] **Step 2: Run strict lint**
  - Run: `npm run lint:strict`

- [ ] **Step 3: Run build**
  - Run: `npm run build`

- [ ] **Step 4: Review git diff**
  - Run: `git status --short`
  - Run: `git diff --stat`
