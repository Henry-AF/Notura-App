# Recording Upload Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar o modo `upload` em `src/app/dashboard/recording/page.tsx`, manter os modos `presencial` e `remota`, atualizar os CTAs para `/dashboard/recording?mode=upload` e aposentar `src/app/dashboard/new/page.tsx` com redirect.

**Architecture:** a tela `dashboard/recording` passa a ser o hub único de entrada para reunião, alternando entre os fluxos de gravação ao vivo e upload manual via `recordingMode`. O fluxo de upload deve reaproveitar a lógica atual de `dashboard/new` por meio de helper compartilhado e componentes já existentes em `src/components/upload`, sem duplicar integração com upload/processamento.

**Tech Stack:** Next.js App Router, React client components, Vitest, Testing Library/file-source tests, helpers em `src/lib/meetings`, UI existente em `src/components/recording` e `src/components/upload`.

---

## File Map

- Modify: `src/components/recording/RecordingSetupCard.tsx`
  Responsibility: expandir `RecordingMode`, permitir o terceiro segmento e renderizar o formulário adequado para cada modo.

- Modify: `src/components/recording/recording-theme.ts`
  Responsibility: definir o tema amarelo do modo `upload`.

- Modify: `src/components/recording/index.ts`
  Responsibility: exportar tipos/componentes novos caso a composição seja extraída.

- Create or Modify: `src/components/recording/RecordingUploadPanel.tsx`
  Responsibility: encapsular o fluxo visual de upload dentro da página de recording, reaproveitando `DropZone`, `UploadProgressCard`, `MeetingForm`, `AiInsightTip` e eventual overlay de progresso.

- Modify: `src/app/dashboard/recording/page.tsx`
  Responsibility: orquestrar os três modos, sincronizar `mode` com query string, alternar entre fluxo de gravação e fluxo de upload, proteger troca de modo quando houver gravação ativa.

- Create or Modify: `src/app/dashboard/recording/recording-upload-api.ts`
  Responsibility: centralizar defaults e submissão do upload manual para a tela de recording.

- Modify or Delete-by-refactor: `src/app/dashboard/new/new-api.ts`
  Responsibility: virar re-export de helper compartilhado, se ainda necessário para manter compatibilidade.

- Create: `src/lib/meetings/meeting-upload-client.ts`
  Responsibility: concentrar o fluxo reutilizável de `fetch defaults`, `init upload` e `process uploaded meeting`.

- Create: `src/lib/meetings/meeting-upload-client.test.ts`
  Responsibility: cobrir o helper compartilhado caso ele passe a conter lógica além de re-exports.

- Modify: `src/app/dashboard/new/page.tsx`
  Responsibility: substituir a tela antiga por redirect para `/dashboard/recording?mode=upload`.

- Modify: `src/components/dashboard/DashboardHeader.tsx`
  Responsibility: apontar o CTA de upload para a nova query route.

- Modify: `src/app/dashboard/dashboard-layout-client.tsx`
  Responsibility: apontar o atalho móvel/lateral de upload para a nova query route.

- Test: `src/components/recording/RecordingSetupCard.test.ts`
  Responsibility: validar a existência e seleção do novo modo.

- Test: `src/app/dashboard/recording/recording-remote-mode.test.ts`
  Responsibility: virar cobertura do hub de modos ou ser complementado por um novo teste focado em upload.

- Create: `src/app/dashboard/recording/recording-upload-mode.test.ts`
  Responsibility: validar a presença do fluxo de upload na página de recording.

- Create: `src/app/dashboard/new/page.test.tsx`
  Responsibility: validar o redirect da rota legada.

## Chunk 1: Shared Upload Client

### Task 1: definir a forma do helper compartilhado

**Files:**
- Create: `src/lib/meetings/meeting-upload-client.ts`
- Test: `src/lib/meetings/meeting-upload-client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  fetchMeetingUploadDefaults,
  initMeetingUpload,
  processUploadedMeeting,
} from "./meeting-upload-client";

it("loads whatsapp defaults through /api/user/me", async () => {
  // mock fetch 200 with user.whatsappNumber
  // expect normalized accountWhatsappNumber
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/meetings/meeting-upload-client.test.ts`
Expected: FAIL because the helper file or exports do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export {
  fetchMeetingIntakeDefaults as fetchMeetingUploadDefaults,
  initMeetingUpload,
  processUploadedMeeting,
} from "@/lib/meetings/meeting-intake-client";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/meetings/meeting-upload-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/meetings/meeting-upload-client.ts src/lib/meetings/meeting-upload-client.test.ts
git commit -m "refactor: add shared meeting upload client"
```

### Task 2: point page-level upload helpers to the shared client

**Files:**
- Modify: `src/app/dashboard/new/new-api.ts`
- Modify: `src/app/dashboard/recording/recording-api.ts`
- Test: `src/app/dashboard/new/new-api.test.ts`
- Test: `src/app/dashboard/recording/recording-api.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that:
- `new-api.ts` re-exports from `@/lib/meetings/meeting-upload-client`
- `recording-api.ts` imports defaults/init/process from the same shared helper

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/dashboard/new/new-api.test.ts src/app/dashboard/recording/recording-api.test.ts`
Expected: FAIL because imports still target the old module.

- [ ] **Step 3: Write minimal implementation**

Update imports/re-exports so both page helpers depend on the same shared client.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/dashboard/new/new-api.test.ts src/app/dashboard/recording/recording-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/new/new-api.ts src/app/dashboard/recording/recording-api.ts src/app/dashboard/new/new-api.test.ts src/app/dashboard/recording/recording-api.test.ts
git commit -m "refactor: reuse shared upload client in dashboard flows"
```

## Chunk 2: Recording Mode UI

### Task 3: add the `upload` mode contract to recording setup

**Files:**
- Modify: `src/components/recording/RecordingSetupCard.tsx`
- Modify: `src/components/recording/recording-theme.ts`
- Test: `src/components/recording/RecordingSetupCard.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `RecordingSetupCard.test.ts` to assert:
- `RecordingMode` includes `"upload"`
- the segmented options include `"Upload"`
- the upload theme uses yellow/amber active styling

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/recording/RecordingSetupCard.test.ts`
Expected: FAIL because the type and option do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `export type RecordingMode = "in-person" | "remote" | "upload";`
- third segmented option with upload icon/label
- `recording-theme.ts` entry for `upload` using amber/yellow active/button classes

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/recording/RecordingSetupCard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/recording/RecordingSetupCard.tsx src/components/recording/recording-theme.ts src/components/recording/RecordingSetupCard.test.ts
git commit -m "feat: add upload recording mode selector"
```

### Task 4: extract the upload panel used by recording

**Files:**
- Create: `src/components/recording/RecordingUploadPanel.tsx`
- Modify: `src/components/recording/index.ts`
- Test: `src/app/dashboard/recording/recording-upload-mode.test.ts`

- [ ] **Step 1: Write the failing test**

Create a source-based or rendered test asserting that the recording page upload panel contains:
- `DropZone`
- `MeetingForm`
- upload progress UI
- no recording start button

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/recording/recording-upload-mode.test.ts`
Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Extract a focused upload panel component that owns:
- selected file
- simulated local progress
- real upload progress
- submit handler for uploaded meetings

Keep each helper under 50 lines by splitting:
- `startUploadPreviewProgress`
- `resetUploadSelection`
- `submitUploadedMeeting`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/recording/recording-upload-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/recording/RecordingUploadPanel.tsx src/components/recording/index.ts src/app/dashboard/recording/recording-upload-mode.test.ts
git commit -m "feat: add upload panel for recording page"
```

### Task 5: integrate the third mode into `recording/page.tsx`

**Files:**
- Modify: `src/app/dashboard/recording/page.tsx`
- Test: `src/app/dashboard/recording/recording-remote-mode.test.ts`
- Test: `src/app/dashboard/recording/recording-upload-mode.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that:
- the page reads `mode=upload` from the query string
- upload mode renders the upload panel
- `in-person` and `remote` still route to `createMicrophoneRecordingCapture` and `createRemoteMeetingRecordingCapture`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/dashboard/recording/recording-remote-mode.test.ts src/app/dashboard/recording/recording-upload-mode.test.ts`
Expected: FAIL because `upload` mode is not wired into the page yet.

- [ ] **Step 3: Write minimal implementation**

Implement page orchestration:
- initialize `recordingMode` from search params with `"upload"` support
- render `RecordingSetupCard` + recording-only flow for live modes
- render `RecordingUploadPanel` for upload mode
- prevent mode switches during active recording or explicitly reset live recording state before allowing the switch
- keep `RecordingOverlay` mounted only for live recording stages

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/dashboard/recording/recording-remote-mode.test.ts src/app/dashboard/recording/recording-upload-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/recording/page.tsx src/app/dashboard/recording/recording-remote-mode.test.ts src/app/dashboard/recording/recording-upload-mode.test.ts
git commit -m "feat: support upload mode in recording page"
```

## Chunk 3: Legacy Route and Entry Points

### Task 6: redirect the legacy `dashboard/new` route

**Files:**
- Modify: `src/app/dashboard/new/page.tsx`
- Create: `src/app/dashboard/new/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create a test that asserts the page redirects to:

```ts
"/dashboard/recording?mode=upload"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/new/page.test.tsx`
Expected: FAIL because the page still renders the old upload UI.

- [ ] **Step 3: Write minimal implementation**

Replace the old page body with a Next.js redirect:

```ts
import { redirect } from "next/navigation";

export default function NewMeetingPage() {
  redirect("/dashboard/recording?mode=upload");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/new/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/new/page.tsx src/app/dashboard/new/page.test.tsx
git commit -m "refactor: redirect legacy new meeting page"
```

### Task 7: repoint dashboard CTAs to the new upload mode

**Files:**
- Modify: `src/components/dashboard/DashboardHeader.tsx`
- Modify: `src/app/dashboard/dashboard-layout-client.tsx`
- Test: `src/app/dashboard/recording/recording-upload-mode.test.ts`

- [ ] **Step 1: Write the failing test**

Add source assertions confirming upload navigation now targets:
- `/dashboard/recording?mode=upload`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/recording/recording-upload-mode.test.ts`
Expected: FAIL because mobile/desktop shortcuts still point to `/dashboard/new`.

- [ ] **Step 3: Write minimal implementation**

Update:
- `onUpload` handler usage in dashboard header flow
- sidebar/mobile create menu upload path in `dashboard-layout-client.tsx`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/recording/recording-upload-mode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardHeader.tsx src/app/dashboard/dashboard-layout-client.tsx src/app/dashboard/recording/recording-upload-mode.test.ts
git commit -m "feat: route dashboard upload entry points to recording mode"
```

## Chunk 4: End-to-End Verification

### Task 8: run the focused verification suite

**Files:**
- No code changes required unless failures reveal regressions

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/lib/meetings/meeting-upload-client.test.ts src/components/recording/RecordingSetupCard.test.ts src/app/dashboard/recording/recording-api.test.ts src/app/dashboard/recording/recording-remote-mode.test.ts src/app/dashboard/recording/recording-upload-mode.test.ts src/app/dashboard/new/page.test.tsx src/app/dashboard/new/new-api.test.ts
```

Expected: PASS

- [ ] **Step 2: Run broader dashboard verification**

Run:

```bash
npm test -- src/app/dashboard
```

Expected: PASS or only unrelated pre-existing failures.

- [ ] **Step 3: If there are failures, fix with TDD before proceeding**

Document whether the failure is:
- caused by this feature
- pre-existing and unrelated

- [ ] **Step 4: Commit final integration if fixes were needed**

```bash
git add <relevant files>
git commit -m "test: finalize recording upload mode integration"
```
