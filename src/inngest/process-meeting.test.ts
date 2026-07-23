import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alertOperator: vi.fn(),
  captureObservedError: vi.fn(),
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  deleteAudio: vi.fn(),
  deleteObject: vi.fn(),
  generateEmbedding: vi.fn(),
  generateMeetingSummary: vi.fn(),
  getWhatsAppSummaryAccess: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  getJsonObject: vi.fn(),
  indexTranscriptChunksWithCheckpoints: vi.fn(),
  listObjectKeys: vi.fn(),
  logStructured: vi.fn(),
  putJsonObject: vi.fn(),
  sendMeetingSummaryTemplate: vi.fn(),
  transcribe: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/r2", () => ({
  getPresignedDownloadUrl: mocks.getPresignedDownloadUrl,
  deleteAudio: mocks.deleteAudio,
  deleteObject: mocks.deleteObject,
  getJsonObject: mocks.getJsonObject,
  listObjectKeys: mocks.listObjectKeys,
  putJsonObject: mocks.putJsonObject,
}));

vi.mock("@/lib/whatsapp", () => ({
  sendMeetingSummaryTemplate: mocks.sendMeetingSummaryTemplate,
  alertOperator: mocks.alertOperator,
}));

vi.mock("@/lib/billing/whatsapp-summary-access", () => ({
  getWhatsAppSummaryAccess: mocks.getWhatsAppSummaryAccess,
}));

vi.mock("@/lib/gemini", () => ({
  generateEmbedding: mocks.generateEmbedding,
  generateMeetingSummary: mocks.generateMeetingSummary,
  PROMPT_VERSION: "1.1.0",
}));

vi.mock("@/lib/jobs/checkpointed-transcript-indexing", () => ({
  indexTranscriptChunksWithCheckpoints:
    mocks.indexTranscriptChunksWithCheckpoints,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

vi.mock("@/lib/jobs/meeting-queue-guardrails", () => ({
  PROCESS_MEETING_CONCURRENCY: 1,
  PROCESS_MEETING_RETRY_ATTEMPTS: 0,
  toNonRetriableJobError: (message: string, error: unknown) =>
    error instanceof Error ? error : new Error(message),
  toProviderQueueError: (_provider: string, error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
}));

vi.mock("assemblyai", () => ({
  AssemblyAI: vi.fn(() => ({
    transcripts: {
      transcribe: mocks.transcribe,
    },
  })),
}));

function createSummaryJson() {
  return {
    version: "1.0",
    meeting: {
      title: "Reuniao",
      date_mentioned: null,
      duration_minutes: null,
      participants: [],
      participant_count: 0,
    },
    decisions: [],
    tasks: [],
    open_items: [],
    next_meeting: {
      datetime: null,
      location_or_link: null,
    },
    summary_one_line: "Resumo em uma linha",
    metadata: {
      prompt_version: "1.1.0",
      total_decisions: 0,
      total_tasks: 0,
      total_open_items: 0,
    },
  };
}

function createSummaryParticipants() {
  return [
    {
      ref: "p1",
      displayName: "Ana",
      originalName: "Speaker A",
      role: "participant",
    },
    {
      ref: "e1",
      displayName: "Acme",
      originalName: "Acme",
      role: "entity",
    },
  ];
}

function createSummaryStructured() {
  return {
    version: 1,
    title: "Reuniao",
    sections: [
      {
        title: "Contexto",
        content: "Acme citada.",
        participantRefs: ["e1"],
      },
    ],
    actionItems: [
      {
        description: "Enviar proposta",
        participantRef: "p1",
        dueDate: null,
        priority: "média",
      },
    ],
  };
}

interface StoredCheckpoint {
  status: string;
  payload: unknown;
  fingerprint: string | null;
  attempts: number;
}

type SupabaseMockWrites = {
  inserts: Array<{ table: string; payload: unknown }>;
  updates: Array<{ table: string; payload: unknown }>;
  upserts: Array<{ table: string; payload: unknown }>;
  operations: Array<{ table: string; operation: string; payload: unknown }>;
};

interface SupabaseMockRefs {
  tableRef: { current: string };
  writes: SupabaseMockWrites;
  checkpointStore: Map<string, StoredCheckpoint>;
  meetingStatuses: string[];
}

function createSelectMock(refs: SupabaseMockRefs) {
  const single = vi.fn(() =>
    Promise.resolve({
      data: { status: refs.meetingStatuses.shift() ?? "pending" },
      error: null,
    })
  );

  return vi.fn(() => {
    const filters: Record<string, unknown> = {};
    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      }),
      single,
      maybeSingle: vi.fn(() => {
        if (refs.tableRef.current === "job_checkpoints") {
          const key = `${String(filters.meeting_id)}::${String(filters.step_name)}`;
          return Promise.resolve({
            data: refs.checkpointStore.get(key) ?? null,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
    return builder;
  });
}

function createUpsertMock(refs: SupabaseMockRefs) {
  return vi.fn((payload: unknown) => {
    const table = refs.tableRef.current;
    refs.writes.upserts.push({ table, payload });
    refs.writes.operations.push({ table, operation: "upsert", payload });

    if (table === "job_checkpoints") {
      const row = payload as Record<string, unknown>;
      refs.checkpointStore.set(`${String(row.meeting_id)}::${String(row.step_name)}`, {
        status: String(row.status),
        payload: row.payload,
        fingerprint: (row.fingerprint as string | null) ?? null,
        attempts: Number(row.attempts),
      });
      return Promise.resolve({ error: null });
    }

    if (table === "meeting_participants") {
      return {
        select: vi.fn().mockResolvedValue({
          data: (payload as Array<Record<string, unknown>>).map((row, index) => ({
            id: index === 0 ? "participant-id" : "entity-id",
            created_at: "2026-05-23T00:00:00.000Z",
            updated_at: "2026-05-23T00:00:00.000Z",
            ...row,
          })),
          error: null,
        }),
      };
    }

    return Promise.resolve({ error: null });
  });
}

function createInsertUpdateDeleteMocks(refs: SupabaseMockRefs) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((payload: unknown) => {
    refs.writes.updates.push({ table: refs.tableRef.current, payload });
    refs.writes.operations.push({
      table: refs.tableRef.current,
      operation: "update",
      payload,
    });
    return { eq: updateEq };
  });

  const insertSingle = vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null });
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn((payload: unknown) => {
    refs.writes.inserts.push({ table: refs.tableRef.current, payload });
    refs.writes.operations.push({
      table: refs.tableRef.current,
      operation: "insert",
      payload,
    });
    return { select: insertSelect };
  });

  const deleteFn = vi.fn(() => ({
    eq: vi.fn((_column: string, value: unknown) => {
      if (refs.tableRef.current === "job_checkpoints") {
        for (const key of [...refs.checkpointStore.keys()]) {
          if (key.startsWith(`${String(value)}::`)) {
            refs.checkpointStore.delete(key);
          }
        }
      }
      return Promise.resolve({ error: null });
    }),
  }));

  return { update, insert, deleteFn };
}

function createSupabaseMock(
  input: {
    meetingStatuses?: string[];
    checkpointStore?: Map<string, StoredCheckpoint>;
  } = {}
) {
  const refs: SupabaseMockRefs = {
    tableRef: { current: "" },
    writes: { inserts: [], updates: [], upserts: [], operations: [] },
    checkpointStore: input.checkpointStore ?? new Map<string, StoredCheckpoint>(),
    meetingStatuses: input.meetingStatuses ?? ["pending"],
  };

  const select = createSelectMock(refs);
  const upsert = createUpsertMock(refs);
  const { update, insert, deleteFn } = createInsertUpdateDeleteMocks(refs);
  const from = vi.fn((table: string) => {
    refs.tableRef.current = table;
    return { select, update, upsert, insert, delete: deleteFn };
  });

  return { from, writes: refs.writes, checkpointStore: refs.checkpointStore };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  mocks.createFunction.mockImplementation(
    (_config: unknown, handler: (input: unknown) => Promise<unknown>) => ({
      handler,
    })
  );
  mocks.createServiceRoleClient.mockReturnValue(createSupabaseMock());
  mocks.getPresignedDownloadUrl.mockResolvedValue("https://r2.example/audio.mp3");
  mocks.deleteAudio.mockResolvedValue(undefined);
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.getJsonObject.mockResolvedValue(null);
  mocks.listObjectKeys.mockResolvedValue([]);
  mocks.putJsonObject.mockResolvedValue(undefined);
  mocks.sendMeetingSummaryTemplate.mockResolvedValue({ success: true });
  mocks.getWhatsAppSummaryAccess.mockResolvedValue({ canSend: true, plan: "pro" });
  mocks.generateMeetingSummary.mockResolvedValue({
    participants: createSummaryParticipants(),
    summaryWhatsapp: "Resumo pronto",
    summaryJson: createSummaryJson(),
    summaryStructured: createSummaryStructured(),
  });
  mocks.generateEmbedding.mockResolvedValue(Array.from({ length: 768 }, () => 0.1));
  mocks.indexTranscriptChunksWithCheckpoints.mockResolvedValue({
    chunkCount: 0,
    batchCount: 0,
  });
  mocks.transcribe.mockResolvedValue({
    id: "assembly-1",
    status: "completed",
    text: "Transcricao completa",
    audio_duration: 6480,
    utterances: [
      {
        start: 0,
        speaker: "A",
        text: "Transcricao completa",
      },
    ],
  });
});

describe("processMeeting - Gemini summary generation", () => {
  it("passes the transcribed audio duration to Gemini summary generation", async () => {
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "+5511999999999",
          userId: "user-1",
        },
      },
      step,
    });

    expect(mocks.generateMeetingSummary).toHaveBeenCalledWith(
      "[00:00] Speaker A: Transcricao completa",
      6480,
      { distinctId: "user-1", traceId: "meeting-1" }
    );
  });

  it("calls Gemini once for summary and participant extraction", async () => {
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "+5511999999999",
          userId: "user-1",
        },
      },
      step,
    });

    expect(mocks.generateMeetingSummary).toHaveBeenCalledTimes(1);
  });
});

describe("processMeeting - transcript indexing", () => {
  it("indexes transcript chunks from AssemblyAI utterances after transcription", async () => {
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "+5511999999999",
          userId: "user-1",
        },
      },
      step,
    });

    expect(mocks.indexTranscriptChunksWithCheckpoints).toHaveBeenCalledWith({
      supabase: expect.any(Object) as object,
      meetingId: "meeting-1",
      jobId: "job-1",
      userId: "user-1",
      transcript: "[00:00] Speaker A: Transcricao completa",
      utterances: [
        {
          start: 0,
          speaker: "A",
          text: "Transcricao completa",
        },
      ],
      embedText: mocks.generateEmbedding,
    });
  });
});

describe("processMeeting - job step tracking", () => {
  it("records the current Inngest processing step in the meeting job", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "+5511999999999",
          userId: "user-1",
        },
      },
      step,
    });

    expect(supabase.writes.inserts).toContainEqual({
      table: "jobs",
      payload: {
        meeting_id: "meeting-1",
        status: "processing",
        current_step: "update-status-processing",
        error_message: null,
      },
    });

    const processingSteps = [
      "transcribe",
      "index-transcript-chunks",
      "summarize-meeting",
      "save-results",
      "send-whatsapp",
    ];
    expect(supabase.writes.updates).toEqual(
      expect.arrayContaining([
        ...processingSteps.map((current_step) => ({
          table: "jobs",
          payload: { status: "processing", current_step, error_message: null },
        })),
        {
          table: "jobs",
          payload: {
            status: "completed",
            current_step: "cleanup",
            error_message: null,
            completed_at: expect.any(String) as string,
          },
        },
      ])
    );
  });
});

describe("processMeeting - participant upserts", () => {
  it("upserts meeting participants before saving structured summary", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "+5511999999999",
          userId: "user-1",
        },
      },
      step,
    });

    expect(supabase.writes.upserts).toContainEqual({
      table: "meeting_participants",
      payload: [
        {
          meeting_id: "meeting-1",
          display_name: "Ana",
          original_name: "Speaker A",
          role: "participant",
        },
        {
          meeting_id: "meeting-1",
          display_name: "Acme",
          original_name: "Acme",
          role: "entity",
        },
      ],
    });
    expect(
      supabase.writes.operations.findIndex(
        (operation) => operation.table === "meeting_participants"
      )
    ).toBeLessThan(
      supabase.writes.operations.findIndex(
        (operation) =>
          operation.table === "meetings" &&
          typeof operation.payload === "object" &&
          operation.payload !== null &&
          "summary_structured" in operation.payload
      )
    );
  });
});

describe("processMeeting - summary structured persistence", () => {
  it("saves summary_structured with database participant ids", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "+5511999999999",
          userId: "user-1",
        },
      },
      step,
    });

    expect(supabase.writes.updates).toContainEqual({
      table: "meetings",
      payload: expect.objectContaining({
        summary_version: 1,
        summary_structured: {
          version: 1,
          title: "Reuniao",
          sections: [
            {
              title: "Contexto",
              content: "Acme citada.",
              participant_ids: ["entity-id"],
            },
          ],
          action_items: [
            {
              description: "Enviar proposta",
              participant_id: "participant-id",
              due_date: null,
              priority: "média",
            },
          ],
        },
      }) as Record<string, unknown>,
    });
  });
});

describe("processMeeting - WhatsApp delivery and cancellation", () => {
  it("skips the WhatsApp send step for users without a paid plan loaded from Supabase", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.getWhatsAppSummaryAccess.mockResolvedValue({ canSend: false, plan: "free" });
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
      event: {
        id: "event-1",
        name: "meeting/process",
        data: {
          meetingId: "meeting-1",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "",
          userId: "user-1",
        },
      },
      step,
    });

    expect(mocks.getWhatsAppSummaryAccess).toHaveBeenCalledWith(
      "user-1",
      expect.any(Object)
    );
    expect(mocks.sendMeetingSummaryTemplate).not.toHaveBeenCalled();
    expect(supabase.writes.updates).not.toEqual(
      expect.arrayContaining([
        {
          table: "jobs",
          payload: expect.objectContaining({
            current_step: "send-whatsapp",
          }) as Record<string, unknown>,
        },
      ])
    );
  });

  it("stops before provider work when the meeting was canceled by the user", async () => {
    const supabase = createSupabaseMock({ meetingStatuses: ["failed"] });
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await expect(
      (processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }).handler({
        event: {
          id: "event-1",
          name: "meeting/process",
          data: {
            meetingId: "meeting-1",
            r2Key: "meetings/user-1/audio.mp3",
            whatsappNumber: "+5511999999999",
            userId: "user-1",
          },
        },
        step,
      })
    ).rejects.toThrow("Meeting processing was canceled by the user.");

    expect(mocks.getPresignedDownloadUrl).not.toHaveBeenCalled();
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });
});

describe("processMeeting - checkpoint resume", () => {
  it("resumes a failed run from checkpoints without re-calling completed providers", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.generateMeetingSummary.mockRejectedValueOnce(new Error("gemini down"));
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };
    const handler = (
      processMeeting as unknown as { handler: (input: unknown) => Promise<unknown> }
    ).handler;
    const event = {
      id: "event-1",
      name: "meeting/process",
      data: {
        meetingId: "meeting-1",
        r2Key: "meetings/user-1/audio.mp3",
        whatsappNumber: "+5511999999999",
        userId: "user-1",
      },
    };

    // First run fails inside summarize-meeting, after transcribe was checkpointed.
    await expect(handler({ event, step })).rejects.toThrow("gemini down");
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    expect(mocks.generateMeetingSummary).toHaveBeenCalledTimes(1);
    expect(supabase.checkpointStore.has("meeting-1::transcribe")).toBe(true);

    // Retry: transcribe replays from its checkpoint; summarize re-executes once.
    await handler({ event, step });
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    expect(mocks.generateMeetingSummary).toHaveBeenCalledTimes(2);

    // A successful cleanup purges the meeting's checkpoints.
    expect(supabase.checkpointStore.size).toBe(0);
  });
});
