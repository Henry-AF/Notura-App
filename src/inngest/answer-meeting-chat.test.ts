import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answerMeetingQuestionFromChunks: vi.fn(),
  captureObservedError: vi.fn(),
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  ensureMeetingChunksIndexed: vi.fn(),
  generateEmbedding: vi.fn(),
  logStructured: vi.fn(),
  matchMeetingTranscriptChunks: vi.fn(),
  toChatSources: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/gemini", () => ({
  answerMeetingQuestionFromChunks: mocks.answerMeetingQuestionFromChunks,
  EMBEDDING_MODEL_NAME: "gemini-embedding-001",
  GEMINI_TEXT_MODEL_NAME: "gemini-3.1-flash-lite-preview",
  generateEmbedding: mocks.generateEmbedding,
}));

vi.mock("@/lib/meetings/rag", () => ({
  estimateTokenCount: (text: string) => {
    const normalized = text.trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/).length;
  },
  ensureMeetingChunksIndexed: mocks.ensureMeetingChunksIndexed,
  matchMeetingTranscriptChunks: mocks.matchMeetingTranscriptChunks,
  toChatSources: mocks.toChatSources,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

function createEmbedding(): number[] {
  return Array.from({ length: 768 }, () => 0.25);
}

function createSupabaseMock(options?: { transcript?: string | null }) {
  const inserts: Record<string, unknown[]> = {};
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const updates: unknown[] = [];
  const chatSingle = vi.fn().mockResolvedValue({
    data: {
      id: "chat-1",
      meeting_id: "meeting-1",
      user_id: "user-1",
      question: "Qual foi o prazo?",
      status: "processing",
    },
    error: null,
  });
  const meetingSingle = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      user_id: "user-1",
      transcript:
        options && "transcript" in options ? options.transcript : "Transcricao salva",
      status: "completed",
    },
    error: null,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((payload: unknown) => {
    updates.push(payload);
    return { eq: updateEq };
  });
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: table === "meeting_chats" ? chatSingle : meetingSingle,
      })),
    })),
    insert: vi.fn((payload: unknown) => {
      inserts[table] = [...(inserts[table] ?? []), payload];
      return Promise.resolve({ error: null });
    }),
    update,
  }));

  return { from, inserts, rpc, updates };
}

async function runJob() {
  const { answerMeetingChat } = await import("./answer-meeting-chat");
  const step = {
    run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
  };

  return (answerMeetingChat as { handler: (input: unknown) => Promise<unknown> })
    .handler({
      event: {
        id: "event-1",
        name: "meeting/chat.answer",
        data: {
          chatId: "chat-1",
          meetingId: "meeting-1",
          userId: "user-1",
        },
      },
      step,
    });
}

describe("answerMeetingChat", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.createFunction.mockImplementation((_config, handler) => ({ handler }));
    mocks.createServiceRoleClient.mockReturnValue(createSupabaseMock());
    mocks.generateEmbedding.mockResolvedValue(createEmbedding());
    mocks.ensureMeetingChunksIndexed.mockResolvedValue([]);
    mocks.matchMeetingTranscriptChunks.mockResolvedValue([
      {
        id: "chunk-1",
        meeting_id: "meeting-1",
        chunk_index: 0,
        text: "O prazo foi sexta.",
        speaker: "A",
        start_ms: 0,
        end_ms: 1000,
        metadata: {},
        similarity: 0.82,
      },
    ]);
    mocks.toChatSources.mockReturnValue([
      {
        chunkId: "chunk-1",
        similarity: 0.82,
        startMs: 0,
        endMs: 1000,
        speaker: "A",
        text: "O prazo foi sexta.",
      },
    ]);
    mocks.answerMeetingQuestionFromChunks.mockResolvedValue({
      answer: "O prazo foi sexta.",
      isAnsweredFromContext: true,
      citedChunkIds: ["chunk-1"],
      insufficientContextReason: null,
    });
  });

  it("saves a confirmed answer with sources", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    await runJob();

    expect(mocks.answerMeetingQuestionFromChunks).toHaveBeenCalledWith({
      question: "Qual foi o prazo?",
      chunks: [
        {
          chunkId: "chunk-1",
          similarity: 0.82,
          startMs: 0,
          endMs: 1000,
          speaker: "A",
          text: "O prazo foi sexta.",
        },
      ],
    });
    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "completed",
        answer: "O prazo foi sexta.",
        fallback_reason: null,
        model_confirmed: true,
        sources: [
          {
            chunkId: "chunk-1",
            similarity: 0.82,
            startMs: 0,
            endMs: 1000,
            speaker: "A",
            text: "O prazo foi sexta.",
          },
        ],
      })
    );
    expect(supabase.inserts.meeting_chat_ai_metrics ?? []).toContainEqual(
      expect.objectContaining({
        chat_id: "chat-1",
        meeting_id: "meeting-1",
        user_id: "user-1",
        status: "completed",
        fallback_reason: null,
        embedding_model: "gemini-embedding-001",
        answer_model: "gemini-3.1-flash-lite-preview",
        retrieved_chunks_count: 1,
        max_similarity: 0.82,
        avg_similarity: 0.82,
        question_tokens_estimated: 4,
        context_tokens_estimated: 4,
        answer_tokens_estimated: 4,
        embedding_duration_ms: expect.any(Number),
        retrieval_duration_ms: expect.any(Number),
        generation_duration_ms: expect.any(Number),
        total_duration_ms: expect.any(Number),
        estimated_cost_usd: expect.any(Number),
      })
    );
  });

  it("saves low_similarity fallback when no chunks are returned", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.matchMeetingTranscriptChunks.mockResolvedValue([]);
    mocks.toChatSources.mockReturnValue([]);

    await runJob();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "completed",
        fallback_reason: "low_similarity",
        model_confirmed: false,
      })
    );
    expect(mocks.answerMeetingQuestionFromChunks).not.toHaveBeenCalled();
    expect(supabase.inserts.meeting_chat_ai_metrics ?? []).toContainEqual(
      expect.objectContaining({
        chat_id: "chat-1",
        meeting_id: "meeting-1",
        user_id: "user-1",
        status: "completed",
        fallback_reason: "low_similarity",
        embedding_model: "gemini-embedding-001",
        answer_model: "gemini-3.1-flash-lite-preview",
        retrieved_chunks_count: 0,
        max_similarity: null,
        avg_similarity: null,
        question_tokens_estimated: 4,
        context_tokens_estimated: 0,
        answer_tokens_estimated: 0,
        embedding_duration_ms: expect.any(Number),
        retrieval_duration_ms: expect.any(Number),
        generation_duration_ms: null,
        total_duration_ms: expect.any(Number),
        estimated_cost_usd: expect.any(Number),
      })
    );
  });

  it("saves not_confirmed_by_model fallback when Gemini refuses the context", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.answerMeetingQuestionFromChunks.mockResolvedValue({
      answer: "Nao sei.",
      isAnsweredFromContext: false,
      citedChunkIds: [],
      insufficientContextReason: "A transcricao nao confirma.",
    });

    await runJob();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "completed",
        fallback_reason: "not_confirmed_by_model",
        model_confirmed: false,
      })
    );
  });

  it("saves not_confirmed_by_model fallback when Gemini cites no retrieved chunks", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.answerMeetingQuestionFromChunks.mockResolvedValue({
      answer: "O prazo foi sexta.",
      isAnsweredFromContext: true,
      citedChunkIds: ["chunk-fora-do-contexto"],
      insufficientContextReason: null,
    });

    await runJob();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "completed",
        fallback_reason: "not_confirmed_by_model",
        model_confirmed: false,
      })
    );
    expect(supabase.updates).not.toContainEqual(
      expect.objectContaining({
        status: "completed",
        model_confirmed: true,
      })
    );
  });

  it("saves no_transcript fallback when the meeting has no transcript", async () => {
    const supabase = createSupabaseMock({ transcript: null });
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    await runJob();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "completed",
        fallback_reason: "no_transcript",
        model_confirmed: false,
      })
    );
    expect(mocks.ensureMeetingChunksIndexed).not.toHaveBeenCalled();
  });

  it("marks the chat as failed on provider errors", async () => {
    const supabase = createSupabaseMock();
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.generateEmbedding.mockRejectedValue(new Error("Gemini unavailable"));

    await runJob();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        fallback_reason: "provider_error",
        error_message: "Gemini unavailable",
      })
    );
    expect(supabase.rpc).toHaveBeenCalledWith("refund_meeting_chat_ai_usage", {
      p_user_id: "user-1",
      p_chat_id: "chat-1",
      p_ai_feature: "meeting_chat",
      p_reason: "provider_error",
    });
  });
});
