# Meeting Chat Metrics Execution Trace Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** transformar `meeting_chat_ai_metrics` na fonte principal de debug do chat de IA, sem criar uma nova tabela.

**Architecture:** a tabela passa a representar uma tentativa de resposta desde o início (`processing`) até o fim (`completed` ou `failed`). `answerMeetingChat` cria uma linha assim que confirma o chat em processamento e atualiza essa linha em todos os caminhos finais.

**Tech Stack:** Supabase/Postgres migrations, Inngest, TypeScript strict, Vitest.

---

### Task 1: Schema

**Files:**
- Create: `supabase/migrations/017_meeting_chat_metrics_execution_trace.sql`
- Modify: `src/types/database.ts`
- Modify: `tests/meeting-chat-ai-metrics-policy.test.ts`

- [ ] **Step 1: Write failing migration/type test**
- [ ] **Step 2: Run the test and verify failure**
- [ ] **Step 3: Add migration and generated type updates**
- [ ] **Step 4: Run the test and verify pass**

### Task 2: Metrics Helper

**Files:**
- Modify: `src/lib/ai/meeting-chat-metrics.ts`

- [ ] **Step 1: Extend metrics payload to include `processing`, `request_id`, `stage`, `error_message`, and timestamps**
- [ ] **Step 2: Add helpers to insert a start row and update a final row**

### Task 3: Answer Job Integration

**Files:**
- Modify: `src/inngest/answer-meeting-chat.ts`
- Modify: `src/inngest/answer-meeting-chat.test.ts`

- [ ] **Step 1: Write failing tests for `processing -> completed` and `processing -> failed`**
- [ ] **Step 2: Create the start metric after loading a processing chat**
- [ ] **Step 3: Update that metric on every completed/failed/fallback path**
- [ ] **Step 4: Run focused tests**

### Task 4: Verification

- [ ] Run `npm test -- tests/meeting-chat-ai-metrics-policy.test.ts src/inngest/answer-meeting-chat.test.ts`
- [ ] Run `npm run build`
