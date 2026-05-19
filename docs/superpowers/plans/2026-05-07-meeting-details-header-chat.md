# Meeting Details Header Chat Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remover os FABs próprios da tela de detalhes da reunião e abrir o chat de IA pelo header, ao lado de `Compartilhar`

**Architecture:** a lógica do chat continua em `MeetingChatSheet`, mas o componente deixa de ter FAB embutido e passa a ser controlado pela tela. `MeetingHeader` ganha uma ação `Chat` opcional, enquanto `AIInsightToast` sai da tela e da codebase para evitar dead code.

**Tech Stack:** Next.js 14, React 18, Tailwind classes, Vitest

---

### Task 1: Cobrir o novo ponto de entrada do chat e a remoção dos FABs

**Files:**
- Create: `src/components/meeting-detail/meeting-detail-actions.test.ts`
- Modify: `src/components/meeting-detail/MeetingHeader.tsx`
- Modify: `src/components/meeting-detail/MeetingChatSheet.tsx`
- Modify: `src/components/meeting-detail/index.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-detail-client.tsx`
- Delete: `src/components/meeting-detail/AIInsightToast.tsx`
- Test: `src/components/meeting-detail/meeting-detail-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Verificar no source que:
- `MeetingHeader` contém o rótulo `Chat`
- `meeting-detail-client` não usa `AIInsightToast`
- `MeetingChatSheet` não contém botão fixo com `position: fixed` nem `aria-label="Abrir análise com IA"`
- o barrel `index.ts` não exporta `AIInsightToast`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/meeting-detail/meeting-detail-actions.test.ts`
Expected: FAIL because the current code still uses `AIInsightToast` and the chat FAB still exists.

- [ ] **Step 3: Write minimal implementation**

Adicionar a action `Chat` ao header, controlar o sheet a partir de `meeting-detail-client`, remover `AIInsightToast` do fluxo e apagar seus exports/arquivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/meeting-detail/meeting-detail-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Run broader verification**

Run: `npm test -- src/components/meeting-detail/meeting-detail-actions.test.ts src/components/ui/app/side-sheet.test.ts`
Expected: PASS with exit code 0.
