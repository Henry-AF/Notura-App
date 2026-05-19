import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alertOperator: vi.fn(),
  captureObservedError: vi.fn(),
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  deleteAudio: vi.fn(),
  generateEmbedding: vi.fn(),
  generateMeetingSummary: vi.fn(),
  getWhatsAppSummaryAccess: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  indexMeetingTranscriptChunks: vi.fn(),
  logStructured: vi.fn(),
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

vi.mock("@/lib/meetings/rag", () => ({
  indexMeetingTranscriptChunks: mocks.indexMeetingTranscriptChunks,
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
  toNonRetriableJobError: (_message: string, error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
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

function createSupabaseMock() {
  const writes = {
    inserts: [] as Array<{ table: string; payload: unknown }>,
    updates: [] as Array<{ table: string; payload: unknown }>,
    upserts: [] as Array<{ table: string; payload: unknown }>,
  };
  const single = vi.fn().mockResolvedValue({
    data: { status: "pending" },
    error: null,
  });
  const selectEq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((payload: unknown) => {
    writes.updates.push({ table: currentTable, payload });
    return { eq: updateEq };
  });
  const upsert = vi.fn((payload: unknown) => {
    writes.upserts.push({ table: currentTable, payload });
    return Promise.resolve({ error: null });
  });
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: "job-1" },
    error: null,
  });
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn((payload: unknown) => {
    writes.inserts.push({ table: currentTable, payload });
    return { select: insertSelect };
  });
  let currentTable = "";
  const from = vi.fn((table: string) => {
    currentTable = table;
    return { select, update, upsert, insert };
  });

  return { from, writes };
}

describe("processMeeting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.createFunction.mockImplementation((_config, handler) => ({ handler }));
    mocks.createServiceRoleClient.mockReturnValue(createSupabaseMock());
    mocks.getPresignedDownloadUrl.mockResolvedValue("https://r2.example/audio.mp3");
    mocks.deleteAudio.mockResolvedValue(undefined);
    mocks.sendMeetingSummaryTemplate.mockResolvedValue({ success: true });
    mocks.getWhatsAppSummaryAccess.mockResolvedValue({ canSend: true, plan: "pro" });
    mocks.generateMeetingSummary.mockResolvedValue({
      summaryWhatsapp: "Resumo pronto",
      summaryJson: createSummaryJson(),
    });
    mocks.generateEmbedding.mockResolvedValue(Array.from({ length: 768 }, () => 0.1));
    mocks.indexMeetingTranscriptChunks.mockResolvedValue([]);
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

  it("passes the transcribed audio duration to Gemini summary generation", async () => {
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as { handler: (input: unknown) => Promise<unknown> }).handler({
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
      6480
    );
  });

  it("indexes transcript chunks from AssemblyAI utterances after transcription", async () => {
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as { handler: (input: unknown) => Promise<unknown> }).handler({
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

    expect(mocks.indexMeetingTranscriptChunks).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      meetingId: "meeting-1",
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

  it("records the current Inngest processing step in the meeting job", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as { handler: (input: unknown) => Promise<unknown> }).handler({
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
    expect(supabase.writes.updates).toEqual(
      expect.arrayContaining([
        {
          table: "jobs",
          payload: {
            status: "processing",
            current_step: "transcribe",
            error_message: null,
          },
        },
        {
          table: "jobs",
          payload: {
            status: "processing",
            current_step: "index-transcript-chunks",
            error_message: null,
          },
        },
        {
          table: "jobs",
          payload: {
            status: "processing",
            current_step: "summarize-meeting",
            error_message: null,
          },
        },
        {
          table: "jobs",
          payload: {
            status: "processing",
            current_step: "save-results",
            error_message: null,
          },
        },
        {
          table: "jobs",
          payload: {
            status: "processing",
            current_step: "send-whatsapp",
            error_message: null,
          },
        },
        {
          table: "jobs",
          payload: {
            status: "completed",
            current_step: "cleanup",
            error_message: null,
            completed_at: expect.any(String),
          },
        },
      ])
    );
  });

  it("skips the WhatsApp send step for users without a paid plan loaded from Supabase", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.getWhatsAppSummaryAccess.mockResolvedValue({ canSend: false, plan: "free" });
    const { processMeeting } = await import("./process-meeting");
    const step = {
      run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    };

    await (processMeeting as { handler: (input: unknown) => Promise<unknown> }).handler({
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
          }),
        },
      ])
    );
  });
});
