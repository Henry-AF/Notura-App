# Settings Modal Stable Size Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** manter o modal de settings com a mesma moldura desktop da aba Perfil, sem encolher ao trocar para outras seções

**Architecture:** a correção fica concentrada em `SettingsModal`. Vamos fixar uma altura mínima desktop no painel e na área de conteúdo, preservando o comportamento mobile e evitando medições dinâmicas.

**Tech Stack:** Next.js 14, React 18, Tailwind classes, Vitest

---

### Task 1: Cobrir e fixar o tamanho estável do modal

**Files:**
- Create: `src/components/settings/SettingsModal.test.ts`
- Modify: `src/components/settings/SettingsModal.tsx`
- Test: `src/components/settings/SettingsModal.test.ts`

- [ ] **Step 1: Write the failing test**

Verificar no source que o painel do `SettingsModal` define uma `minHeight` desktop estável e que a área de conteúdo também preserva essa altura mínima.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/settings/SettingsModal.test.ts`
Expected: FAIL because the modal currently shrinks with shorter tabs.

- [ ] **Step 3: Write minimal implementation**

Adicionar uma `minHeight` desktop equivalente à moldura do Perfil no container do modal e na coluna de conteúdo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/settings/SettingsModal.test.ts`
Expected: PASS.

- [ ] **Step 5: Run broader verification**

Run: `npm test -- src/components/settings/SettingsModal.test.ts src/components/settings/PlanModal.test.ts`
Expected: PASS with exit code 0.
