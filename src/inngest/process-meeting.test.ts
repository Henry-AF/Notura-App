import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alertOperator: vi.fn(),
  captureObservedError: vi.fn(),
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  deleteAudio: vi.fn(),
  generateEmbedding: vi.fn(),
  generateMeetingSummary: vi.fn(),
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
  const single = vi.fn().mockResolvedValue({
    data: { status: "pending" },
    error: null,
  });
  const selectEq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ select, update, upsert }));

  return { from };
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
});
