# Meeting RAG Chat Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend RAG chat flow for one-question meeting chats backed by transcript chunks, Gemini embeddings, pgvector HNSW search, async Inngest answering, and persisted answers.

**Architecture:** Meeting processing indexes AssemblyAI utterances into `meeting_transcript_chunks`. Chat routes create and read persisted `meeting_chats`; `meeting/chat.answer` handles backfill, embedding, vector retrieval, guarded Gemini answering, fallbacks, and source persistence. All owned API access stays behind `withAuth` and `requireOwnership`.

**Tech Stack:** Next.js 14 Route Handlers, Supabase/Postgres/pgvector, Inngest, AssemblyAI utterances, Gemini `embedding-001`, Gemini flash model, Vitest.

---

## File Structure

- Create `supabase/migrations/013_meeting_rag_chat.sql`: pgvector extension, chunk/chat tables, RLS, HNSW index, RPC search function.
- Modify `src/types/database.ts`: add chunk/chat table types and RPC type.
- Create `src/lib/meetings/rag.ts`: question validation, utterance parsing/chunking, backfill helpers, persistence, retrieval source mapping.
- Create `src/lib/meetings/rag.test.ts`: focused unit tests for validation, chunking, transcript parsing, RPC arguments, and persistence shape.
- Modify `src/lib/gemini.ts`: add embedding and RAG answer helpers, preserving summary behavior.
- Modify `src/lib/gemini.test.ts`: tests for 768-dimensional embeddings and strict JSON answer contract.
- Modify `src/inngest/process-meeting.ts`: keep raw utterances from AssemblyAI and index chunks after transcript save.
- Modify `src/inngest/process-meeting.test.ts`: asserts chunk indexing receives utterances and meeting/user ids.
- Create `src/inngest/answer-meeting-chat.ts`: async chat answer function and failure handling.
- Create `src/inngest/answer-meeting-chat.test.ts`: tests for confirmed answer, low similarity, model-not-confirmed, and missing transcript.
- Modify `src/app/api/inngest/route.ts`: register chat answer functions.
- Create `src/app/api/meetings/[id]/chats/route.ts`: create one-message chat and enqueue job.
- Create `src/app/api/meetings/[id]/chats/route.test.ts`: route auth/ownership, validation, insert, enqueue tests.
- Create `src/app/api/meetings/[id]/chats/[chatId]/route.ts`: fetch chat status and sources.
- Create `src/app/api/meetings/[id]/chats/[chatId]/route.test.ts`: route auth/ownership and response mapping tests.
- Modify `src/app/api/api-auth-policy.test.ts`: include new private routes and ownership enforcement.
- Create `tests/meeting-rag-migration-policy.test.ts`: SQL policy test for vector dimensions, HNSW, RLS, and RPC guardrails.

## Chunk 1: Database Contract

### Task 1: Migration Policy Test

**Files:**
- Create: `tests/meeting-rag-migration-policy.test.ts`
- Create later: `supabase/migrations/013_meeting_rag_chat.sql`

- [ ] **Step 1: Write the failing test**

Add tests that read `supabase/migrations/013_meeting_rag_chat.sql` and assert:

```ts
expect(sql).toContain("create extension if not exists vector");
expect(sql).toContain("embedding vector(768)");
expect(sql).toContain("using hnsw");
expect(sql).toContain("vector_cosine_ops");
expect(sql).toContain("p_limit integer default 5");
expect(sql).toContain("p_similarity_threshold double precision default 0.6");
expect(sql).toContain("alter table meeting_transcript_chunks enable row level security");
expect(sql).toContain("alter table meeting_chats enable row level security");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/meeting-rag-migration-policy.test.ts`
Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Write migration**

Create `013_meeting_rag_chat.sql` with:

- `create extension if not exists vector;`
- `meeting_transcript_chunks` with `embedding vector(768)` and unique `(meeting_id, chunk_index)`.
- HNSW cosine index:
  `create index ... using hnsw (embedding vector_cosine_ops);`
- `meeting_chats` with one question/answer row, `question_embedding vector(768)`, status check, fallback fields, sources JSONB.
- RLS policies scoped by `auth.uid() = user_id`.
- `match_meeting_transcript_chunks(...)` SQL function using `1 - (embedding <=> p_query_embedding)` and limiting by `least(p_limit, 5)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/meeting-rag-migration-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/meeting-rag-migration-policy.test.ts supabase/migrations/013_meeting_rag_chat.sql
git commit -m "feat: add meeting rag database schema"
```

### Task 2: Database Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Write the failing type-oriented test**

Extend `tests/meeting-rag-migration-policy.test.ts` or add a small compile-facing test in `src/lib/meetings/rag.test.ts` that imports `Database` and references:

```ts
type ChunkRow = Database["public"]["Tables"]["meeting_transcript_chunks"]["Row"];
type ChatRow = Database["public"]["Tables"]["meeting_chats"]["Row"];
type MatchArgs = Database["public"]["Functions"]["match_meeting_transcript_chunks"]["Args"];
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/meetings/rag.test.ts tests/meeting-rag-migration-policy.test.ts`
Expected: FAIL because table/function types are missing.

- [ ] **Step 3: Add database types**

Add table aliases and typed rows. Embeddings should be `number[]` in TS insert/update surfaces because Supabase serializes vectors from arrays.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/meetings/rag.test.ts tests/meeting-rag-migration-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/types/database.ts src/lib/meetings/rag.test.ts tests/meeting-rag-migration-policy.test.ts
git commit -m "feat: type meeting rag tables"
```

## Chunk 2: RAG Library

### Task 3: Question Validation And Chunking

**Files:**
- Create: `src/lib/meetings/rag.ts`
- Create: `src/lib/meetings/rag.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- `validateMeetingChatQuestion("Uma pergunta curta?")` returns normalized text.
- More than 500 chars throws/returns `question_too_long`.
- More than 3 sentence endings throws/returns `question_too_long`.
- `buildTranscriptChunksFromUtterances` merges utterances up to about 400 tokens.
- Chunk metadata preserves `speaker`, `start_ms`, `end_ms`, and utterance list.
- `buildTranscriptChunksFromFormattedTranscript` parses `[MM:SS] Speaker A: ...` for old meetings.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/meetings/rag.test.ts`
Expected: FAIL with missing module/exports.

- [ ] **Step 3: Implement minimal library**

Add:

- `MAX_CHAT_QUESTION_CHARS = 500`
- `MAX_CHAT_QUESTION_SENTENCES = 3`
- `TRANSCRIPT_CHUNK_TARGET_TOKENS = 400`
- `estimateTokenCount(text: string)`
- `validateMeetingChatQuestion(question: unknown)`
- `buildTranscriptChunksFromUtterances(utterances)`
- `buildTranscriptChunksFromFormattedTranscript(transcript)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/meetings/rag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/meetings/rag.ts src/lib/meetings/rag.test.ts
git commit -m "feat: chunk meeting transcripts for rag"
```

### Task 4: Chunk Persistence And Retrieval

**Files:**
- Modify: `src/lib/meetings/rag.ts`
- Modify: `src/lib/meetings/rag.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- `indexMeetingTranscriptChunks` deletes/replaces existing chunks for a meeting and upserts rows with embeddings.
- It calls Gemini embedding once per chunk with 768-dimensional output.
- `ensureMeetingChunksIndexed` returns existing chunks when present.
- Backfill uses `meetings.transcript` when no chunks exist.
- `matchMeetingTranscriptChunks` calls RPC with `p_limit: 5` and `p_similarity_threshold: 0.6`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/meetings/rag.test.ts`
Expected: FAIL because persistence helpers are missing.

- [ ] **Step 3: Implement minimal persistence helpers**

Add helpers that accept injected `supabaseAdmin` and embedding function where useful for unit tests:

- `indexMeetingTranscriptChunks`
- `ensureMeetingChunksIndexed`
- `matchMeetingTranscriptChunks`
- `toChatSources`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/meetings/rag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/meetings/rag.ts src/lib/meetings/rag.test.ts
git commit -m "feat: persist and search meeting rag chunks"
```

## Chunk 3: Gemini Helpers

### Task 5: Embeddings

**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/gemini.test.ts`

- [ ] **Step 1: Write failing test**

Assert `generateEmbedding("texto")` calls Gemini with model `embedding-001`, `taskType: "RETRIEVAL_DOCUMENT"` by default, and `outputDimensionality: 768`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/gemini.test.ts`
Expected: FAIL because `generateEmbedding` is missing.

- [ ] **Step 3: Implement minimal embedding helper**

Use existing retry/client helpers. Validate result length is 768 and throw on empty embedding.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/gemini.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/gemini.ts src/lib/gemini.test.ts
git commit -m "feat: add gemini embedding helper"
```

### Task 6: RAG Answer Prompt

**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/gemini.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- `answerMeetingQuestionFromChunks` includes the strict system instruction.
- It parses JSON fields `answer`, `is_answered_from_context`, `insufficient_context_reason`.
- It rejects invalid JSON or missing boolean confirmation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/gemini.test.ts`
Expected: FAIL because the answer helper is missing.

- [ ] **Step 3: Implement minimal answer helper**

Add a small prompt builder that sends only retrieved chunks and question. Return a typed result:

```ts
{ answer: string; isAnsweredFromContext: boolean; insufficientContextReason: string | null }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/gemini.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/gemini.ts src/lib/gemini.test.ts
git commit -m "feat: answer meeting questions from chunks"
```

## Chunk 4: Inngest Indexing And Answering

### Task 7: Index Chunks During Meeting Processing

**Files:**
- Modify: `src/inngest/process-meeting.ts`
- Modify: `src/inngest/process-meeting.test.ts`

- [ ] **Step 1: Write failing test**

Mock `indexMeetingTranscriptChunks` and assert `processMeeting` calls it after transcription with `meetingId`, `userId`, formatted transcript, and raw utterances.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/inngest/process-meeting.test.ts`
Expected: FAIL because indexing is not called.

- [ ] **Step 3: Implement minimal integration**

Import the RAG helper, return utterances from the transcribe step, and add a step named `index-transcript-chunks`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/inngest/process-meeting.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/inngest/process-meeting.ts src/inngest/process-meeting.test.ts
git commit -m "feat: index meeting transcript chunks"
```

### Task 8: Chat Answer Job

**Files:**
- Create: `src/inngest/answer-meeting-chat.ts`
- Create: `src/inngest/answer-meeting-chat.test.ts`
- Modify: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- Confirmed answer path saves `answer`, `model_confirmed: true`, `sources`, `completed_at`.
- No chunks above threshold saves fallback `low_similarity`.
- Gemini not confirmed saves fallback `not_confirmed_by_model`.
- Missing transcript saves fallback `no_transcript`.
- Provider exception marks chat `failed` with `provider_error`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/inngest/answer-meeting-chat.test.ts`
Expected: FAIL because job is missing.

- [ ] **Step 3: Implement minimal job**

Create Inngest function `answerMeetingChat` triggered by `meeting/chat.answer`. Use service role Supabase, load chat/meeting, ensure chunks, embed question, match chunks, call Gemini answer helper, and update `meeting_chats`.

- [ ] **Step 4: Register job and run tests**

Run: `npm test -- src/inngest/answer-meeting-chat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/inngest/answer-meeting-chat.ts src/inngest/answer-meeting-chat.test.ts src/app/api/inngest/route.ts
git commit -m "feat: answer meeting chat asynchronously"
```

## Chunk 5: API Routes

### Task 9: Create Chat Route

**Files:**
- Create: `src/app/api/meetings/[id]/chats/route.ts`
- Create: `src/app/api/meetings/[id]/chats/route.test.ts`
- Modify: `src/app/api/api-auth-policy.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- Unowned meeting returns 403 through `requireOwnership`.
- Long question returns 400 with `question_too_long`.
- Meeting not completed returns 409/422 with `meeting_not_ready`.
- Valid question inserts `meeting_chats` row and sends `meeting/chat.answer`.
- Response status is 202 with `{ chatId, status: "processing" }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/meetings/[id]/chats/route.test.ts src/app/api/api-auth-policy.test.ts`
Expected: FAIL because route and policy entries are missing.

- [ ] **Step 3: Implement minimal route**

Use `withAuth`, `requireOwnership`, `validateMeetingChatQuestion`, service role Supabase, explicit insert fields, and `inngest.send`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/meetings/[id]/chats/route.test.ts src/app/api/api-auth-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/api/meetings/[id]/chats/route.ts src/app/api/meetings/[id]/chats/route.test.ts src/app/api/api-auth-policy.test.ts
git commit -m "feat: create meeting chat requests"
```

### Task 10: Read Chat Route

**Files:**
- Create: `src/app/api/meetings/[id]/chats/[chatId]/route.ts`
- Create: `src/app/api/meetings/[id]/chats/[chatId]/route.test.ts`
- Modify: `src/app/api/api-auth-policy.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- Unowned meeting returns 403.
- Chat from another meeting/user returns 403 or 404.
- Valid chat maps snake_case DB fields to camelCase API response.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/meetings/[id]/chats/[chatId]/route.test.ts src/app/api/api-auth-policy.test.ts`
Expected: FAIL because route is missing.

- [ ] **Step 3: Implement minimal route**

Use `withAuth`, `requireOwnership` for meeting, then query `meeting_chats` by `id`, `meeting_id`, `user_id`. Return camelCase response.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/meetings/[id]/chats/[chatId]/route.test.ts src/app/api/api-auth-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/api/meetings/[id]/chats/[chatId]/route.ts src/app/api/meetings/[id]/chats/[chatId]/route.test.ts src/app/api/api-auth-policy.test.ts
git commit -m "feat: read meeting chat responses"
```

## Chunk 6: Final Verification

### Task 11: Focused And Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- \
  tests/meeting-rag-migration-policy.test.ts \
  src/lib/meetings/rag.test.ts \
  src/lib/gemini.test.ts \
  src/inngest/process-meeting.test.ts \
  src/inngest/answer-meeting-chat.test.ts \
  src/app/api/meetings/[id]/chats/route.test.ts \
  src/app/api/meetings/[id]/chats/[chatId]/route.test.ts \
  src/app/api/api-auth-policy.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit final fixes if needed**

Only commit if verification requires additional edits.

- [ ] **Step 5: Report result**

Summarize files changed, commits made, and exact verification commands with outcomes.
