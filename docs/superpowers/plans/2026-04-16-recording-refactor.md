# Dashboard Recording Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar `dashboard/recording` para seguir o mesmo fluxo arquitetural de `dashboard/new`, com formulário mínimo, overlay separado de gravação e envio do arquivo gravado para o pipeline padrão de upload e processamento.

**Architecture:** A página de gravação ficará apenas na camada de UI e passará a consumir um helper próprio (`recording-api.ts`). O fluxo reutilizável de carregar defaults do usuário, inicializar upload e enfileirar o processamento será extraído para `lib/`, para que `dashboard/new` e `dashboard/recording` compartilhem a mesma fonte de verdade. A gravação ficará encapsulada em componentes pequenos e um utilitário de browser para reduzir o tamanho da página.

**Tech Stack:** Next.js App Router, React client components, Tailwind, shadcn/ui, Vitest, browser MediaRecorder APIs, Cloudflare R2 signed upload flow, Inngest queueing flow.

---

## Chunk 1: Shared Intake Flow

### Task 1: Extract shared browser-side intake helpers to `lib/`

**Files:**
- Create: `src/lib/meetings/meeting-intake-client.ts`
- Create: `src/lib/meetings/meeting-intake-client.test.ts`
- Modify: `src/app/dashboard/new/new-api.ts`
- Modify: `src/app/dashboard/new/new-api.test.ts`
- Modify: `src/lib/meetings/upload-client.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the focused tests and verify they fail**
- [ ] **Step 3: Implement the minimal shared helper for defaults/upload/process**
- [ ] **Step 4: Rewire `new-api.ts` and `upload-client.ts` to use the shared helper**
- [ ] **Step 5: Re-run the focused tests and verify they pass**

### Task 2: Add the recording page companion helper

**Files:**
- Create: `src/app/dashboard/recording/recording-api.ts`
- Create: `src/app/dashboard/recording/recording-api.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the focused tests and verify they fail**
- [ ] **Step 3: Implement the minimal helper API for recording defaults and recorded uploads**
- [ ] **Step 4: Re-run the focused tests and verify they pass**

## Chunk 2: Recording UI Refactor

### Task 3: Build reusable recording components

**Files:**
- Create: `src/components/recording/RecordingSetupCard.tsx`
- Create: `src/components/recording/RecordingOverlay.tsx`
- Create: `src/components/recording/RecordingWaveform.tsx`
- Create: `src/components/recording/index.ts`
- Modify: `src/components/upload/MeetingForm.tsx` or create a smaller shared WhatsApp selector component only if reuse is cleaner than duplication

- [ ] **Step 1: Implement the smallest reusable components needed for setup + overlay**
- [ ] **Step 2: Keep the WhatsApp selector UX aligned with `dashboard/new`**
- [ ] **Step 3: Verify props/interfaces keep business logic out of the UI components**

### Task 4: Refactor `dashboard/recording/page.tsx`

**Files:**
- Modify: `src/app/dashboard/recording/page.tsx`

- [ ] **Step 1: Replace the current monolithic page with the minimal setup screen**
- [ ] **Step 2: Remove participants/invite/transcript/pause-resume flows**
- [ ] **Step 3: Add the separate recording overlay with waveform + timer**
- [ ] **Step 4: Add the stop confirmation state with discard vs generate summary**
- [ ] **Step 5: Wire save flow to upload `mp4` and redirect to `/dashboard/processing?id=...`**

## Chunk 3: Verification

### Task 5: Validate the refactor end-to-end

**Files:**
- Verify: `src/app/dashboard/recording/recording-api.test.ts`
- Verify: `src/lib/meetings/meeting-intake-client.test.ts`
- Verify: `src/app/dashboard/new/new-api.test.ts`
- Verify: `src/app/api/meetings/upload/route.test.ts`

- [ ] **Step 1: Run targeted tests for the extracted shared flow and recording helper**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Confirm no direct `fetch` remains in `dashboard/recording/page.tsx`**
