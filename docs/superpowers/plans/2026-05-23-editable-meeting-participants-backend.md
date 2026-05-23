# Editable Meeting Participants Backend Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation for editable meeting participant and entity names, with read-time summary rendering from the latest `display_name`.

**Architecture:** A single Gemini summary call returns participants, entities, and a structured summary with temporary refs. Backend Zod validation persists `meeting_participants`, rewrites refs to database UUIDs in `meetings.summary_structured`, and read helpers hydrate/render names without re-calling LLM.

**Tech Stack:** Next.js 14 Route Handlers, Supabase/Postgres/RLS, Inngest, Gemini via `src/lib/gemini.ts`, Vitest, TypeScript, Zod.

---

Spec: `docs/superpowers/specs/2026-05-23-editable-meeting-participants-backend-design.md`

Implementation rules:

- Follow `ARCHITECTURE.md`.
- No production code before a failing test.
- Do not add a second Gemini call for participant extraction.
- Do not process AI in route handlers.
- Keep Supabase access in API/lib backend code.
- Keep all route mutations whitelisted.
- Preserve legacy fallback for meetings without `summary_structured`.

## File Structure

- Create: `tests/meeting-participants-schema.test.ts`
  - SQL contract test for migration.
- Create: `supabase/migrations/023_meeting_participants_summary_structured.sql`
  - Adds `meeting_participants`, RLS, indexes, updated-at trigger, and meeting columns.
- Modify: `package.json`
  - Add direct `zod` dependency if absent.
- Modify: `package-lock.json`
  - Lock direct `zod` dependency.
- Modify: `src/types/database.ts`
  - Add table types, row aliases, relation type, and structured summary types.
- Create: `src/lib/meetings/summary-structured.ts`
  - Zod schemas, ref validation, ref-to-id rewriting, and legacy conversion helpers.
- Create: `src/lib/meetings/summary-structured.test.ts`
  - Unit tests for validation and rewriting.
- Create: `src/lib/meetings/summary-renderer.ts`
  - Read-time hydrated summary renderer.
- Create: `src/lib/meetings/summary-renderer.test.ts`
  - Tests for current `display_name`, role filtering, and legacy fallback.
- Create: `src/lib/meetings/participants.ts`
  - Backend helpers for listing, upserting, and renaming participants/entities.
- Create: `src/lib/meetings/participants.test.ts`
  - Unit tests for validation, ownership-scoped helpers, and update payload whitelist.
- Modify: `src/lib/gemini.ts`
  - Prompt and result shape for one-call participant/entity extraction plus summary.
- Modify: `src/lib/gemini.test.ts`
  - Prompt/result validation tests.
- Modify: `src/inngest/process-meeting.ts`
  - Persist participants/entities and structured summary from the one Gemini call.
- Modify: `src/inngest/process-meeting.test.ts`
  - Pipeline ordering and persistence tests.
- Modify: `src/lib/meetings/detail.ts`
  - Select `meeting_participants(*)`.
- Modify: `src/app/dashboard/meetings/[id]/meeting-types.ts`
  - Add editable participant/entity fields to detail data.
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.ts`
  - Prefer hydrated structured summary for page data.
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.test.ts`
  - Verify display names update read output and entities are separate.
- Modify: `src/lib/api/rate-limit-policies.ts`
  - Add participant list/mutate policies.
- Create: `src/app/api/meetings/[id]/participants/route.ts`
  - `GET` editable participants/entities for a meeting.
- Create: `src/app/api/meetings/[id]/participants/route.test.ts`
  - Auth, ownership, and response shape tests.
- Create: `src/app/api/meetings/[id]/participants/[participantId]/route.ts`
  - `PATCH` `displayName`.
- Create: `src/app/api/meetings/[id]/participants/[participantId]/route.test.ts`
  - Ownership, validation, and whitelist tests.
- Modify: `src/app/api/api-auth-policy.test.ts`
  - Add the new private routes and ownership routes.

## Chunk 1: Schema And Types

### Task 1: Migration Contract

**Files:**
- Create: `tests/meeting-participants-schema.test.ts`
- Create: `supabase/migrations/023_meeting_participants_summary_structured.sql`

- [ ] **Step 1: Write the failing migration policy test**

Create `tests/meeting-participants-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/023_meeting_participants_summary_structured.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting participants schema", () => {
  it("creates editable meeting participants and structured summary columns", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists public.meeting_participants");
    expect(sql).toContain("id uuid primary key default gen_random_uuid()");
    expect(sql).toContain("meeting_id uuid not null references public.meetings(id) on delete cascade");
    expect(sql).toContain("display_name text not null");
    expect(sql).toContain("original_name text not null");
    expect(sql).toContain("role text not null");
    expect(sql).toContain("role in ('participant', 'entity')");
    expect(sql).toContain("summary_structured jsonb");
    expect(sql).toContain("summary_version integer not null default 1");
    expect(sql).toContain("unique (meeting_id, role, original_name)");
    expect(sql).toContain("idx_meeting_participants_meeting_id");
    expect(sql).toContain("idx_meeting_participants_meeting_role");
  });

  it("protects meeting participants with owner-scoped RLS policies", () => {
    const sql = readMigration();

    expect(sql).toContain("alter table public.meeting_participants enable row level security");
    expect(sql).toContain("meeting_participants_own_select");
    expect(sql).toContain("meeting_participants_own_insert");
    expect(sql).toContain("meeting_participants_own_update");
    expect(sql).toContain("meeting_participants_own_delete");
    expect(sql).toContain("meetings.user_id = auth.uid()");
    expect(sql).toContain("grant select, insert, update, delete on public.meeting_participants to authenticated");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/meeting-participants-schema.test.ts`

Expected: FAIL because `023_meeting_participants_summary_structured.sql` does not exist.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/023_meeting_participants_summary_structured.sql` with:

```sql
alter table public.meetings
  add column if not exists summary_structured jsonb,
  add column if not exists summary_version integer not null default 1;

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  display_name text not null,
  original_name text not null,
  role text not null check (role in ('participant', 'entity')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_participants_display_name_not_blank
    check (char_length(trim(display_name)) > 0),
  constraint meeting_participants_display_name_length
    check (char_length(trim(display_name)) <= 80),
  constraint meeting_participants_original_name_not_blank
    check (char_length(trim(original_name)) > 0),
  constraint meeting_participants_unique_original_name
    unique (meeting_id, role, original_name)
);

create index if not exists idx_meeting_participants_meeting_id
  on public.meeting_participants(meeting_id);

create index if not exists idx_meeting_participants_meeting_role
  on public.meeting_participants(meeting_id, role);

create or replace function public.touch_meeting_participants_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_meeting_participants_updated_at
  on public.meeting_participants;
create trigger touch_meeting_participants_updated_at
  before update on public.meeting_participants
  for each row
  execute function public.touch_meeting_participants_updated_at();

alter table public.meeting_participants enable row level security;

drop policy if exists "meeting_participants_own_select"
  on public.meeting_participants;
drop policy if exists "meeting_participants_own_insert"
  on public.meeting_participants;
drop policy if exists "meeting_participants_own_update"
  on public.meeting_participants;
drop policy if exists "meeting_participants_own_delete"
  on public.meeting_participants;

create policy "meeting_participants_own_select"
  on public.meeting_participants for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

create policy "meeting_participants_own_insert"
  on public.meeting_participants for insert
  with check (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

create policy "meeting_participants_own_update"
  on public.meeting_participants for update
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

create policy "meeting_participants_own_delete"
  on public.meeting_participants for delete
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.meeting_participants
  to authenticated;
grant all on public.meeting_participants to service_role;
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `npm test -- tests/meeting-participants-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit schema contract**

```bash
git add tests/meeting-participants-schema.test.ts supabase/migrations/023_meeting_participants_summary_structured.sql
git commit -m "feat: add editable meeting participants schema"
```

### Task 2: Database Types And Zod Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/database.ts`
- Test: `src/lib/meetings/summary-structured.test.ts` in the next task compiles these types

- [ ] **Step 1: Add direct Zod dependency**

Run: `npm install zod@3.25.76 --save`

Expected: `package.json` has a direct `"zod"` dependency and `package-lock.json` is updated without changing unrelated packages.

- [ ] **Step 2: Update generated-style database types manually**

Modify `src/types/database.ts`:

- Add `summary_structured: Json | null` and `summary_version: number` to `meetings.Row`.
- Add optional insert/update fields for both columns.
- Add `meeting_participants` table with Row/Insert/Update/Relationships.
- Add aliases:

```ts
export type MeetingParticipant =
  Database["public"]["Tables"]["meeting_participants"]["Row"]
export type MeetingParticipantRole = "participant" | "entity"
```

- Extend `MeetingWithRelations`:

```ts
export type MeetingWithRelations =
  Database["public"]["Tables"]["meetings"]["Row"] & {
    tasks: Database["public"]["Tables"]["tasks"]["Row"][]
    decisions: Database["public"]["Tables"]["decisions"]["Row"][]
    open_items: Database["public"]["Tables"]["open_items"]["Row"][]
    meeting_participants: Database["public"]["Tables"]["meeting_participants"]["Row"][]
  }
```

- Add structured summary interfaces:

```ts
export interface MeetingStructuredSummary {
  version: number
  title: string | null
  sections: Array<{
    title: string
    content: string
    participant_ids: string[]
  }>
  action_items: Array<{
    description: string
    participant_id: string | null
    due_date: string | null
    priority: Priority
  }>
}
```

- [ ] **Step 3: Run targeted type check through an existing test import**

Run: `npm test -- 'src/app/dashboard/meetings/[id]/meeting-api.test.ts'`

Expected: PASS or existing unrelated test behavior unchanged. If it fails because fixtures lack `summary_structured`, update fixtures in that test with `summary_structured: null`, `summary_version: 1`, and `meeting_participants: []`.

- [ ] **Step 4: Commit types and dependency**

```bash
git add package.json package-lock.json src/types/database.ts 'src/app/dashboard/meetings/[id]/meeting-api.test.ts'
git commit -m "feat: add meeting participant database types"
```

## Chunk 2: Structured Summary Validation And Rendering

### Task 3: Structured Summary Zod Schema And Ref Rewriter

**Files:**
- Create: `src/lib/meetings/summary-structured.ts`
- Create: `src/lib/meetings/summary-structured.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `src/lib/meetings/summary-structured.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";
import {
  parseGeminiMeetingSummaryEnvelope,
  rewriteStructuredSummaryRefs,
} from "./summary-structured";

const envelope = {
  participants: [
    {
      ref: "p1",
      display_name: "Ana",
      original_name: "Speaker A",
      role: "participant",
    },
    {
      ref: "e1",
      display_name: "Acme",
      original_name: "Acme",
      role: "entity",
    },
  ],
  summary_whatsapp: "Resumo pronto",
  summary_json: {
    version: "1.0",
    meeting: { title: "Reuniao", participants: ["Ana"], participant_count: 1 },
    decisions: [],
    tasks: [],
    open_items: [],
  },
  summary_structured: {
    version: 1,
    title: "Reuniao",
    sections: [
      { title: "Contexto", content: "A Acme foi citada.", participant_refs: ["e1"] },
    ],
    action_items: [
      {
        description: "Enviar proposta",
        participant_ref: "p1",
        due_date: null,
        priority: "média",
      },
    ],
  },
};

describe("parseGeminiMeetingSummaryEnvelope", () => {
  it("accepts participants, entities and structured refs from one Gemini envelope", () => {
    const parsed = parseGeminiMeetingSummaryEnvelope(envelope);
    expect(parsed.participants).toHaveLength(2);
    expect(parsed.summaryStructured.actionItems[0].participantRef).toBe("p1");
  });

  it("rejects section refs that are not declared in participants", () => {
    const invalid = structuredClone(envelope);
    invalid.summary_structured.sections[0].participant_refs = ["missing"];

    expect(() => parseGeminiMeetingSummaryEnvelope(invalid)).toThrow(
      "Gemini returned structured summary refs that were not declared"
    );
  });

  it("rejects action item owners that point to entities", () => {
    const invalid = structuredClone(envelope);
    invalid.summary_structured.action_items[0].participant_ref = "e1";

    expect(() => parseGeminiMeetingSummaryEnvelope(invalid)).toThrow(
      "Action item participant_ref must point to a participant"
    );
  });
});

describe("rewriteStructuredSummaryRefs", () => {
  it("rewrites temporary refs to database ids", () => {
    const parsed = parseGeminiMeetingSummaryEnvelope(envelope);
    const result = rewriteStructuredSummaryRefs(parsed.summaryStructured, {
      p1: { id: "participant-id", role: "participant" },
      e1: { id: "entity-id", role: "entity" },
    });

    expect(result.sections[0].participant_ids).toEqual(["entity-id"]);
    expect(result.action_items[0].participant_id).toBe("participant-id");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/meetings/summary-structured.test.ts`

Expected: FAIL because `summary-structured.ts` does not exist.

- [ ] **Step 3: Implement schemas and rewriting**

Create `src/lib/meetings/summary-structured.ts`:

- Export `parseGeminiMeetingSummaryEnvelope`.
- Export `rewriteStructuredSummaryRefs`.
- Use Zod for input validation.
- Normalize snake_case Gemini output into camelCase internal objects.
- Keep function lengths under 50 lines.
- Validate all refs after Zod parse.
- Enforce action item owner refs can only target `role = "participant"`.

Core exports:

```ts
export interface GeminiMeetingParticipantDraft {
  ref: string;
  displayName: string;
  originalName: string;
  role: MeetingParticipantRole;
}

export interface ParsedGeminiMeetingSummaryEnvelope {
  participants: GeminiMeetingParticipantDraft[];
  summaryWhatsapp: string;
  summaryJson: MeetingJSON;
  summaryStructured: StructuredSummaryDraft;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/meetings/summary-structured.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit structured schema helpers**

```bash
git add src/lib/meetings/summary-structured.ts src/lib/meetings/summary-structured.test.ts
git commit -m "feat: validate structured meeting summaries"
```

### Task 4: Read-Time Summary Renderer

**Files:**
- Create: `src/lib/meetings/summary-renderer.ts`
- Create: `src/lib/meetings/summary-renderer.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Create `src/lib/meetings/summary-renderer.test.ts` with tests that assert:

- `role = "participant"` rows become effective participants.
- `role = "entity"` rows become entities, not participants.
- summary text uses current `display_name`.
- legacy meetings without `summary_structured` return existing `summary_whatsapp`.

Use fixtures:

```ts
const participants = [
  {
    id: "p1-id",
    meeting_id: "meeting-1",
    display_name: "Ana Atualizada",
    original_name: "Speaker A",
    role: "participant",
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
  {
    id: "e1-id",
    meeting_id: "meeting-1",
    display_name: "Acme Atualizada",
    original_name: "Acme",
    role: "entity",
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
];
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/meetings/summary-renderer.test.ts`

Expected: FAIL because `summary-renderer.ts` does not exist.

- [ ] **Step 3: Implement renderer**

Create `src/lib/meetings/summary-renderer.ts` with:

```ts
export interface RenderedMeetingSummary {
  text: string;
  participants: Array<{ id: string; name: string; originalName: string }>;
  entities: Array<{ id: string; name: string; originalName: string }>;
  sections: Array<{ title: string; content: string; participants: string[] }>;
  actionItems: Array<{
    description: string;
    participantId: string | null;
    participantName: string | null;
    dueDate: string | null;
    priority: Priority;
  }>;
}
```

Implementation rules:

- Do not mutate `summary_structured`.
- Treat unknown participant IDs as `"Participante removido"` in rendered text.
- Build text from sections and action items in a deterministic plain-text format.
- For fallback, use `summary_whatsapp ?? ""` and participants from legacy `summary_json.meeting.participants`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/meetings/summary-renderer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit renderer**

```bash
git add src/lib/meetings/summary-renderer.ts src/lib/meetings/summary-renderer.test.ts
git commit -m "feat: render meeting summaries with current names"
```

## Chunk 3: Gemini And Inngest Pipeline

### Task 5: Gemini One-Call Envelope

**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/gemini.test.ts`

- [ ] **Step 1: Update failing Gemini tests**

Modify `src/lib/gemini.test.ts`:

- Update `createValidGeminiResponse()` to include `participants` and `summary_structured`.
- Add a test that the system prompt tells Gemini entities are not effective participants.
- Add a test that `generateMeetingSummary` returns `participants` and `summaryStructured`.
- Add a test that an entity owner in `action_items[].participant_ref` rejects the response.

Expected assertion examples:

```ts
expect(result.participants).toEqual([
  expect.objectContaining({ ref: "p1", role: "participant" }),
  expect.objectContaining({ ref: "e1", role: "entity" }),
]);
expect(result.summaryStructured.actionItems[0].participantRef).toBe("p1");
```

- [ ] **Step 2: Run Gemini tests to verify they fail**

Run: `npm test -- src/lib/gemini.test.ts`

Expected: FAIL because `generateMeetingSummary` still returns the old shape.

- [ ] **Step 3: Update Gemini prompt and parser**

Modify `src/lib/gemini.ts`:

- Import `parseGeminiMeetingSummaryEnvelope`.
- Update `MeetingSummaryResult` to include:

```ts
participants: GeminiMeetingParticipantDraft[];
summaryStructured: StructuredSummaryDraft;
```

- Update `SYSTEM_SUMMARIZE` schema instructions to require:
  - `participants[]`
  - `summary_whatsapp`
  - legacy `summary_json`
  - `summary_structured`
- Preserve the existing unprocessable transcript handling, but make it reject before persistence as today.
- Keep `summary_json` for legacy tasks/decisions/open_items and WhatsApp compatibility.
- Do not create or call a new participant extraction function.

- [ ] **Step 4: Run Gemini tests to verify they pass**

Run: `npm test -- src/lib/gemini.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Gemini one-call envelope**

```bash
git add src/lib/gemini.ts src/lib/gemini.test.ts
git commit -m "feat: return participants in meeting summary envelope"
```

### Task 6: Participant Persistence Helpers

**Files:**
- Create: `src/lib/meetings/participants.ts`
- Create: `src/lib/meetings/participants.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/lib/meetings/participants.test.ts` covering:

- `normalizeDisplayName` trims and rejects blank values.
- `normalizeDisplayName` rejects values over 80 chars.
- `buildParticipantUpserts` maps Gemini drafts to Supabase rows.
- `mapParticipantRefsToIds` returns `ref -> { id, role }`.
- `updateMeetingParticipantDisplayNameForUser` calls `requireOwnership` on `meetings`.
- update payload contains only `display_name`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/meetings/participants.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement participant helpers**

Create `src/lib/meetings/participants.ts` with focused exports:

```ts
export class MeetingParticipantValidationError extends Error {}

export function normalizeDisplayName(value: unknown): string;

export function buildParticipantUpserts(input: {
  meetingId: string;
  participants: GeminiMeetingParticipantDraft[];
}): MeetingParticipantInsert[];

export async function upsertMeetingParticipants(input: {
  supabase: SupabaseAdminClient;
  meetingId: string;
  participants: GeminiMeetingParticipantDraft[];
}): Promise<Record<string, { id: string; role: MeetingParticipantRole }>>;

export async function listMeetingParticipantsForUser(...): Promise<MeetingParticipant[]>;

export async function updateMeetingParticipantDisplayNameForUser(...): Promise<MeetingParticipant>;
```

Implementation notes:

- `upsertMeetingParticipants` uses `upsert(..., { onConflict: "meeting_id,role,original_name" })`.
- Select back `id, meeting_id, display_name, original_name, role, created_at, updated_at`.
- Build the returned map by matching `role + original_name` to the original draft refs.
- Rename helper confirms the participant belongs to the meeting before update.
- Route handlers will catch `MeetingParticipantValidationError` as 400.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/meetings/participants.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit participant helpers**

```bash
git add src/lib/meetings/participants.ts src/lib/meetings/participants.test.ts
git commit -m "feat: add meeting participant helpers"
```

### Task 7: Inngest Save Flow

**Files:**
- Modify: `src/inngest/process-meeting.ts`
- Modify: `src/inngest/process-meeting.test.ts`

- [ ] **Step 1: Write failing Inngest tests**

Modify `src/inngest/process-meeting.test.ts`:

- Update `createSummaryJson()` fixture to coexist with new envelope.
- Mock `generateMeetingSummary` to return:

```ts
{
  participants: [
    { ref: "p1", displayName: "Ana", originalName: "Speaker A", role: "participant" },
    { ref: "e1", displayName: "Acme", originalName: "Acme", role: "entity" },
  ],
  summaryWhatsapp: "Resumo pronto",
  summaryJson: createSummaryJson(),
  summaryStructured: {
    version: 1,
    title: "Reuniao",
    sections: [{ title: "Contexto", content: "Acme citada.", participantRefs: ["e1"] }],
    actionItems: [
      {
        description: "Enviar proposta",
        participantRef: "p1",
        dueDate: null,
        priority: "média",
      },
    ],
  },
}
```

- Add test: `calls Gemini once for summary and participant extraction`.
- Add test: `upserts meeting participants before saving structured summary`.
- Add test: `saves summary_structured with database participant ids`.

- [ ] **Step 2: Run Inngest tests to verify they fail**

Run: `npm test -- src/inngest/process-meeting.test.ts`

Expected: FAIL because `processMeeting` does not persist participants or `summary_structured`.

- [ ] **Step 3: Implement Inngest persistence**

Modify `src/inngest/process-meeting.ts`:

- Import `upsertMeetingParticipants` and `rewriteStructuredSummaryRefs`.
- Destructure new `participants` and `summaryStructured` from `generateMeetingSummary`.
- Add a `ProcessingStepName` value such as `"save-participants"` if you want participant persistence tracked separately.
- Do not add any new Gemini/LLM step.
- In save flow:
  1. upsert participants/entities
  2. rewrite `summaryStructured` refs to ids
  3. update `meetings.summary_structured` and `summary_version`
  4. keep existing `summary_whatsapp`, `summary_json`, `title`, `prompt_version`
- Use `summaryStructured.title ?? summaryJson.meeting?.title ?? "Reunião processada"` for title.
- Keep tasks/decisions/open_items upserts from `summaryJson` unchanged.

- [ ] **Step 4: Run Inngest tests to verify they pass**

Run: `npm test -- src/inngest/process-meeting.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Inngest pipeline**

```bash
git add src/inngest/process-meeting.ts src/inngest/process-meeting.test.ts
git commit -m "feat: persist structured meeting participants"
```

## Chunk 4: Read APIs And Rename APIs

### Task 8: Hydrated Meeting Detail Read Model

**Files:**
- Modify: `src/lib/meetings/detail.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-types.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.test.ts`

- [ ] **Step 1: Write failing detail mapping tests**

Modify `src/app/dashboard/meetings/[id]/meeting-api.test.ts`:

- Add `summary_structured`, `summary_version`, and `meeting_participants` to fixtures.
- Expect `meeting.participants` to include only `role = "participant"`.
- Add a new `entities` expectation if `MeetingDetailData` gets entities.
- Expect `meeting.summary` to contain current `display_name` values from `meeting_participants`.
- Keep existing legacy fixture coverage for meetings without `summary_structured`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- 'src/app/dashboard/meetings/[id]/meeting-api.test.ts'`

Expected: FAIL because detail mapping still reads legacy `summary_json.meeting.participants`.

- [ ] **Step 3: Implement hydrated read mapping**

Modify `src/lib/meetings/detail.ts`:

```ts
.select("*, tasks(*), decisions(*), open_items(*), meeting_participants(*)")
```

Modify `src/app/dashboard/meetings/[id]/meeting-types.ts`:

```ts
participants: Array<{ id?: string; name: string; originalName?: string }>;
entities: Array<{ id: string; name: string; originalName: string }>;
```

Modify `src/app/dashboard/meetings/[id]/meeting-api.ts`:

- Import `renderMeetingSummary`.
- Prefer rendered structured summary when `meeting.summary_structured` exists.
- Fallback to current legacy behavior when it does not.
- Do not directly parse entities in the UI mapper; delegate to renderer.

- [ ] **Step 4: Run detail mapping tests to verify they pass**

Run: `npm test -- 'src/app/dashboard/meetings/[id]/meeting-api.test.ts'`

Expected: PASS.

- [ ] **Step 5: Commit hydrated detail read**

```bash
git add src/lib/meetings/detail.ts 'src/app/dashboard/meetings/[id]/meeting-types.ts' 'src/app/dashboard/meetings/[id]/meeting-api.ts' 'src/app/dashboard/meetings/[id]/meeting-api.test.ts'
git commit -m "feat: hydrate meeting summaries at read time"
```

### Task 9: Participant List And Rename Routes

**Files:**
- Modify: `src/lib/api/rate-limit-policies.ts`
- Create: `src/app/api/meetings/[id]/participants/route.ts`
- Create: `src/app/api/meetings/[id]/participants/route.test.ts`
- Create: `src/app/api/meetings/[id]/participants/[participantId]/route.ts`
- Create: `src/app/api/meetings/[id]/participants/[participantId]/route.test.ts`
- Modify: `src/app/api/api-auth-policy.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `src/app/api/meetings/[id]/participants/route.test.ts`:

- 403 when meeting ownership fails.
- 200 returns participants and entities for owned meeting.
- uses `withAuthRateLimit`.

Create `src/app/api/meetings/[id]/participants/[participantId]/route.test.ts`:

- 403 when meeting ownership fails.
- 403 when participant does not belong to meeting.
- 400 for invalid JSON.
- 400 for blank `displayName`.
- 400 for over-80-char `displayName`.
- 200 updates only `display_name`.
- ignores attempted `role`, `original_name`, or `meeting_id` fields.

Modify `src/app/api/api-auth-policy.test.ts` to include:

```ts
"src/app/api/meetings/[id]/participants/route.ts",
"src/app/api/meetings/[id]/participants/[participantId]/route.ts",
```

and include the participant id route in `ID_ROUTES_REQUIRING_OWNERSHIP`.

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
npm test -- 'src/app/api/meetings/[id]/participants/route.test.ts' 'src/app/api/meetings/[id]/participants/[participantId]/route.test.ts' src/app/api/api-auth-policy.test.ts
```

Expected: FAIL because routes do not exist and policy list points at missing files.

- [ ] **Step 3: Add rate limit policies**

Modify `src/lib/api/rate-limit-policies.ts`:

```ts
meetingParticipantsRead: {
  bucket: "api:meetings/[id]/participants",
  limit: 60,
  windowMs: 60_000,
},
meetingParticipantsMutate: {
  bucket: "api:meetings/[id]/participants/[participantId]",
  limit: 30,
  windowMs: 60_000,
},
```

- [ ] **Step 4: Implement routes**

Create `src/app/api/meetings/[id]/participants/route.ts`:

- Use `withAuthRateLimit`.
- Call `requireOwnership(auth.supabaseAdmin, "meetings", params.id, auth.user.id)`.
- Call `listMeetingParticipantsForUser`.
- Return `{ participants, entities }`, split by role.

Create `src/app/api/meetings/[id]/participants/[participantId]/route.ts`:

- Use `withAuthRateLimit`.
- Call `requireOwnership` for the meeting before mutation.
- Parse body safely.
- Whitelist only `displayName`.
- Call `updateMeetingParticipantDisplayNameForUser`.
- Return `{ participant }`.
- Catch `MeetingParticipantValidationError` as 400.
- Catch `Response` from ownership helpers directly.

- [ ] **Step 5: Run route tests to verify they pass**

Run:

```bash
npm test -- 'src/app/api/meetings/[id]/participants/route.test.ts' 'src/app/api/meetings/[id]/participants/[participantId]/route.test.ts' src/app/api/api-auth-policy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit routes**

```bash
git add src/lib/api/rate-limit-policies.ts 'src/app/api/meetings/[id]/participants' src/app/api/api-auth-policy.test.ts
git commit -m "feat: add meeting participant edit APIs"
```

## Chunk 5: Compatibility And Full Verification

### Task 10: Legacy Compatibility And WhatsApp Safety

**Files:**
- Modify as needed: `src/lib/whatsapp.ts`
- Modify as needed: `src/lib/whatsapp.test.ts`
- Modify as needed: `src/app/api/meetings/[id]/resend/route.ts`
- Modify as needed: `src/app/api/meetings/[id]/resend/route.test.ts`

- [ ] **Step 1: Run existing WhatsApp and resend tests**

Run:

```bash
npm test -- src/lib/whatsapp.test.ts 'src/app/api/meetings/[id]/resend/route.test.ts'
```

Expected: PASS. If tests fail because `summary_json` fixtures need new meeting fields, update only fixtures. Do not switch WhatsApp to structured summary unless required by a failing test.

- [ ] **Step 2: Add compatibility tests only if a regression appears**

If WhatsApp resend loses title/participants after the new shape, add a test that old `summary_json` still sends the same template data.

- [ ] **Step 3: Commit compatibility fixes if any**

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts 'src/app/api/meetings/[id]/resend/route.ts' 'src/app/api/meetings/[id]/resend/route.test.ts'
git commit -m "fix: preserve legacy summary compatibility"
```

Skip this commit if no files changed.

### Task 11: Final Verification

**Files:**
- All touched files

- [ ] **Step 1: Run targeted feature tests**

Run:

```bash
npm test -- tests/meeting-participants-schema.test.ts src/lib/meetings/summary-structured.test.ts src/lib/meetings/summary-renderer.test.ts src/lib/meetings/participants.test.ts src/lib/gemini.test.ts src/inngest/process-meeting.test.ts 'src/app/dashboard/meetings/[id]/meeting-api.test.ts' 'src/app/api/meetings/[id]/participants/route.test.ts' 'src/app/api/meetings/[id]/participants/[participantId]/route.test.ts' src/app/api/api-auth-policy.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader relevant tests**

Run:

```bash
npm test -- 'src/app/api/meetings/[id]/route.test.ts' src/app/api/api-rate-limit-critical-routes.test.ts src/lib/whatsapp.test.ts 'src/app/api/meetings/[id]/resend/route.test.ts'
```

Expected: PASS.

- [ ] **Step 3: Run strict lint on changed source files**

Run:

```bash
npm run lint:strict -- src/lib/meetings/summary-structured.ts src/lib/meetings/summary-renderer.ts src/lib/meetings/participants.ts src/lib/gemini.ts src/inngest/process-meeting.ts src/lib/meetings/detail.ts 'src/app/dashboard/meetings/[id]/meeting-api.ts' 'src/app/api/meetings/[id]/participants/route.ts' 'src/app/api/meetings/[id]/participants/[participantId]/route.ts' src/lib/api/rate-limit-policies.ts
```

Expected: PASS.

- [ ] **Step 4: Run full test suite if targeted checks pass**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Inspect final git diff**

Run: `git status --short`

Expected: only intentional feature changes remain, plus any pre-existing unrelated untracked files that were present before implementation.

Run: `git diff --stat HEAD`

Expected: feature diff is limited to schema, summary validation/rendering, Gemini, Inngest, detail read, participant APIs, and tests.

- [ ] **Step 6: Final commit if verification changes were needed**

If verification required small follow-up edits:

```bash
git add <changed-files>
git commit -m "test: verify editable meeting participants backend"
```
