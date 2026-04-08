# Notura — Architecture & Code Guidelines

> Read this entire file before generating any code.
> These rules are non-negotiable and apply to every contribution.

---

## Stack

- **Next.js 14** — App Router
- **Supabase** — Postgres + Auth + RLS
- **Inngest** — background jobs (transcription, summarisation)
- **Cloudflare R2** — audio storage
- **AssemblyAI** — audio transcription
- **Gemini 2.5 Flash** — summarisation via `@/lib/gemini`

---

## Rule #1 — Supabase never in the frontend

The Supabase client is **never** instantiated in components, pages or client-side hooks.
Every database operation goes through a Route Handler under `/app/api/`.

```typescript
// ❌ FORBIDDEN — inside any component, page or hook
import { createClient } from "@/lib/supabase/client";
const { data } = await supabase.from("meetings").select();

// ✅ CORRECT — component fetches from its own API
const res = await fetch("/api/meetings");
const data = await res.json();
```

---

## Rule #2 — Every route uses `withAuth` + `requireOwnership`

Every Route Handler that receives a resource by ID must:

1. Use `withAuth` as a wrapper (from `@/lib/api/ownership`)
2. Call `requireOwnership` before any read or mutation
3. Never call `.eq("id", id)` without first confirming the resource belongs to the user

```typescript
// ✅ Required pattern for routes with :id
import { withAuth, requireOwnership } from "@/lib/api/ownership";

export const DELETE = withAuth(async (_req, { params, auth }) => {
  await requireOwnership(auth.supabase, "meetings", params.id, auth.user.id);

  await auth.supabase.from("meetings").delete().eq("id", params.id);
  return new NextResponse(null, { status: 204 });
});
```

```typescript
// ❌ FORBIDDEN — delete without ownership check
export async function DELETE(_req, { params }) {
  const supabase = createServiceRoleClient();
  await supabase.from("meetings").delete().eq("id", params.id);
}
```

---

## Rule #3 — Field whitelist on mutations

Never pass `body` directly to Supabase. Always explicitly declare which fields
the client is allowed to change.

```typescript
// ❌ FORBIDDEN — raw body passed to update
await supabase.from("meetings").update(body).eq("id", params.id);

// ✅ CORRECT — explicit whitelist
const allowed = {
  ...(body.title !== undefined && { title: String(body.title) }),
};
await supabase.from("meetings").update(allowed).eq("id", params.id);
```

Fields that **must never** be changed by the client:
`user_id`, `status`, `dedupe_key`, `prompt_version`, `cost_usd`, `assemblyai_transcript_id`.

---

## Rule #4 — Meeting processing always via Inngest

Never process audio or call external AI APIs inside a synchronous Route Handler.
The correct flow is: route fires event → Inngest processes in the background.

```typescript
// ❌ FORBIDDEN — synchronous processing inside the route
export async function POST(req) {
  const transcript = await assemblyai.transcribe(audio);
  const summary = await gemini.summarize(transcript);
}

// ✅ CORRECT — fire and return immediately
export async function POST(req) {
  await inngest.send({ name: "meeting/process", data: { meetingId, r2Key, userId } });
  return NextResponse.json({ status: "processing" }, { status: 202 });
}
```

---

## Rule #5 — Upsert with dedupe_key, never plain insert

`tasks`, `decisions` and `open_items` use `dedupe_key` for idempotency.
Never `insert` into these tables — always `upsert` with `onConflict`.

```typescript
// ❌ FORBIDDEN
await supabase.from("tasks").insert(tasks);

// ✅ CORRECT
await supabase.from("tasks").upsert(tasks, { onConflict: "meeting_id,dedupe_key" });
```

---

## Rule #6 — Reusable logic lives in `lib/`

Any function that interacts with an external library (Supabase, Inngest, AssemblyAI,
Gemini, R2, WhatsApp, etc.) or that can be reused across more than one file must live
under `@/lib/`. New code must use the existing helpers in `lib/` before introducing
new ones.

```typescript
// ❌ FORBIDDEN — inline fetch to an external service inside a route or component
const result = await fetch("https://api.assemblyai.com/...", { ... });

// ✅ CORRECT — use the existing lib wrapper
import { transcribeAudio } from "@/lib/assemblyai";
const result = await transcribeAudio(audioUrl);
```

```typescript
// ❌ FORBIDDEN — duplicating a helper that already exists in lib/
function parseJsonSafe(text: string) { ... } // defined again in a route file

// ✅ CORRECT — import from lib
import { parseJson } from "@/lib/api-client";
```

When adding a genuinely new integration or utility, create it in `lib/` first,
then import it where needed. Never let library-specific code leak into pages,
components or route handlers directly.

---

## Meeting status — fixed enum

```
pending → processing → completed
                     → failed
```

Never write status strings as raw literals outside of type definitions.

---

## Folder structure

```
src/
  app/
    api/                  ← All database and business logic lives here
      meetings/
      tasks/
      decisions/
    (dashboard)/          ← UI only — no Supabase, no business logic
  lib/
    api/
      ownership.ts        ← withAuth, requireOwnership, ApiError
    supabase/
      server.ts           ← createServiceRoleClient() — backend only
      client.ts           ← browser Auth only
    api-client.ts         ← shared fetch utilities (parseJson, normalizeError, etc.)
    gemini.ts             ← Gemini integration
    assemblyai.ts         ← AssemblyAI integration
    r2.ts                 ← Cloudflare R2 integration
    inngest/              ← background job definitions
  components/             ← UI only, no direct database access
```

---

## Rule #7 — Every new page requires a companion API helper and test file

Every new screen/page must be accompanied by two files in the same folder:

- `page-name-api.ts` — all fetch calls and data mapping for that page
- `page-name-api.test.ts` — unit tests for every exported function

The page component itself **never** calls `fetch` directly. It imports from the
companion helper instead.

```
src/app/(dashboard)/
  meetings/
    page.tsx                    ← UI only, imports from meetings-api.ts
    meetings-api.ts             ← fetch calls + data mapping for this page
    meetings-api.test.ts        ← tests for every function in meetings-api.ts

  meetings/[id]/
    page.tsx
    meeting-detail-api.ts
    meeting-detail-api.test.ts
```

**Helper file — what it looks like:**

The helper has two responsibilities: fetching data from the API and mapping the
raw API response into the shape the page component expects. Keep these concerns
as separate named functions.

```typescript
// meeting-detail-api.ts
import type { MeetingFile, MeetingTask } from "@/components/meeting-detail";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { normalizeError, parseJson } from "@/lib/api-client";
import type { MeetingJSON, MeetingWithRelations } from "@/types/database";

export interface MeetingDetailData {
  clientName: string;
  meetingDate: string;
  meetingStatus: "completed" | "processing" | "failed" | "scheduled";
  participants: Array<{ name: string }>;
  summary: string;
  tasks: MeetingTask[];
  decisions: Array<{ id: string; description: string; decided_by: string | null }>;
  openItems: Array<{ id: string; description: string; context: string | null }>;
}

interface MeetingDetailResponse extends Partial<MeetingWithRelations> {
  error?: string;
}

// Pure mapping function — no fetch, no side effects. Easy to unit test.
export function mapMeetingDetail(meeting: MeetingWithRelations): MeetingDetailData {
  const summaryJson = (meeting.summary_json as MeetingJSON | null) ?? null;

  const participants =
    summaryJson?.meeting?.participants?.map((name) => ({ name })) ?? [];

  const tasks: MeetingTask[] = (meeting.tasks ?? []).map((task) => ({
    id: task.id,
    text: task.description,
    completed: task.completed,
    assignee: task.owner ?? undefined,
    dueDate: task.due_date ? formatDate(task.due_date) : undefined,
  }));

  const decisions = (meeting.decisions ?? []).map((d) => ({
    id: d.id,
    description: d.description,
    decided_by: d.decided_by,
  }));

  const openItems = (meeting.open_items ?? []).map((item) => ({
    id: item.id,
    description: item.description,
    context: item.context,
  }));

  return {
    clientName: meeting.client_name ?? meeting.title ?? "—",
    meetingDate: formatRelativeTime(meeting.meeting_date ?? meeting.created_at),
    meetingStatus: normalizeMeetingStatus(meeting.status),
    participants,
    summary: meeting.summary_whatsapp ?? "",
    tasks,
    decisions,
    openItems,
  };
}

// Fetch function — calls the API, delegates parsing to mapMeetingDetail.
export async function fetchMeetingDetail(id: string): Promise<MeetingDetailData> {
  const response = await fetch(`/api/meetings/${id}`, { method: "GET" });
  const body = await parseJson<MeetingDetailResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar reunião."));
  }

  return mapMeetingDetail(body as MeetingWithRelations);
}

function normalizeMeetingStatus(
  status: string | null | undefined
): MeetingDetailData["meetingStatus"] {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}
```

**Page component — what it looks like:**

```typescript
// page.tsx

// ❌ FORBIDDEN — fetch directly in the component
const res = await fetch("/api/meetings/123");

// ✅ CORRECT — import from the companion helper
import { fetchMeetingDetail } from "./meeting-detail-api";
const meeting = await fetchMeetingDetail(params.id);
```

**Test file — what it covers:**

Mapping functions (`mapMeeting*`) are pure and must be tested with fixture data.
Fetch functions must be tested with a mocked `fetch`.

```typescript
// meeting-detail-api.test.ts
import { mapMeetingDetail, fetchMeetingDetail } from "./meeting-detail-api";
import type { MeetingWithRelations } from "@/types/database";

// ── mapMeetingDetail ──────────────────────────────────────────────────────────

const baseMeeting: MeetingWithRelations = {
  id: "1",
  title: "Sprint Planning",
  status: "completed",
  tasks: [],
  decisions: [],
  open_items: [],
  // ... other required fields
};

describe("mapMeetingDetail", () => {
  it("maps title to clientName when client_name is absent", () => {
    const result = mapMeetingDetail({ ...baseMeeting, client_name: null });
    expect(result.clientName).toBe("Sprint Planning");
  });

  it("returns processing status for unknown status values", () => {
    const result = mapMeetingDetail({ ...baseMeeting, status: "pending" });
    expect(result.meetingStatus).toBe("processing");
  });
});

// ── fetchMeetingDetail ────────────────────────────────────────────────────────

global.fetch = vi.fn();

describe("fetchMeetingDetail", () => {
  it("returns mapped data on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(baseMeeting), { status: 200 })
    );
    const result = await fetchMeetingDetail("1");
    expect(result.clientName).toBe("Sprint Planning");
  });

  it("throws with the API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    );
    await expect(fetchMeetingDetail("1")).rejects.toThrow("Not found");
  });
});
```

---

## Code Quality Rules

- **Maximum function length: 50 lines.** If a function exceeds this, extract a named helper.
- **Maximum cyclomatic complexity: 8.** Deeply nested conditionals must be refactored.
- **Prefer small, composable functions** over large monolithic ones. Each function should
  do one thing and do it well.

```typescript
// ❌ AVOID — one large function doing everything
async function processAndSave(transcript: string) {
  // 80 lines of mixed concerns
}

// ✅ PREFER — small, named steps
const summary = await generateSummary(transcript);
const tasks   = extractTasks(summary);
await saveTasks(supabase, meetingId, tasks);
```

---

## TypeScript Strictness

Trust the type system. Do not write code that second-guesses types that are
already proven non-null by the compiler or by prior validation.

- **Do NOT use optional chaining (`?.`) on non-nullable types.**
- **Do NOT use nullish coalescing (`??`) when a value is guaranteed to exist.**
- **If a value may be null, express it explicitly in the type** — `string | null`,
  not `string` with a defensive `?? ""` at every call site.
- Avoid unnecessary defensive coding. If a type says it's there, treat it as there.

```typescript
// ❌ AVOID — optional chaining on a type that is already string
function greet(name: string) {
  return `Hello, ${name?.trim()}`; // name is never null here
}

// ✅ CORRECT — trust the type
function greet(name: string) {
  return `Hello, ${name.trim()}`;
}

// ❌ AVOID — ?? masking a type that should be fixed upstream
const title = summaryJson.meeting?.title ?? "";

// ✅ CORRECT — type reflects reality, ?? is used only when genuinely T | null/undefined
// type: title: string | undefined
const title = summaryJson.meeting.title ?? "Untitled";
```

---

## AI Code Guidelines

These rules apply specifically to code generated by AI tools (Claude, Codex, etc.).

- **Do not introduce redundant null checks.** If a value cannot be null at that point
  in the code, do not check for null.
- **Do not add `try/catch` blocks unless the function explicitly needs error handling.**
  Let errors propagate to the nearest handler (`withAuth`, Inngest retry, etc.).
- **Avoid overly defensive patterns** such as `if (!array) return []` when the type
  guarantees `array` is always an array.
- **Favor clarity and correctness over "safe-looking" code.** Code that lies about
  its types is harder to maintain than code that surfaces the real shape of data.
- **Do not silently swallow errors with empty `catch` blocks.**

```typescript
// ❌ AVOID — defensive pattern that contradicts the type
function buildKeys(items: Task[]): string[] {
  if (!items) return []; // items is Task[], never null
  return items.map(buildKey);
}

// ✅ CORRECT — trust the type, keep it simple
function buildKeys(items: Task[]): string[] {
  return items.map(buildKey);
}
```

---

## Pre-generation checklist

Before writing any code, verify:

- [ ] Does this code access Supabase? → Must be inside `/app/api/`
- [ ] Does the route receive an `:id`? → Use `withAuth` + `requireOwnership`
- [ ] Is there a mutation? → Explicit field whitelist
- [ ] Is this audio/AI processing? → Fire an Inngest event, do not process inline
- [ ] Is this an insert into `tasks`, `decisions` or `open_items`? → `upsert` with `dedupe_key`
- [ ] Does this interact with an external library? → Must live in or import from `lib/`
- [ ] Does a `lib/` helper already exist for this? → Use it, do not rewrite it
- [ ] Is any function longer than 50 lines? → Extract named helpers
- [ ] Is there optional chaining on a non-nullable type? → Remove it
- [ ] Is there a null check on a value the type guarantees exists? → Remove it
- [ ] Is this a new page? → Create `page-name-api.ts` and `page-name-api.test.ts` alongside it