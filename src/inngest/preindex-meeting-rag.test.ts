import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  ensureMeetingChunksIndexed: vi.fn(),
  generateEmbedding: vi.fn(),
  logStructured: vi.fn(),
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
  generateEmbedding: mocks.generateEmbedding,
}));

vi.mock("@/lib/meetings/rag", () => ({
  ensureMeetingChunksIndexed: mocks.ensureMeetingChunksIndexed,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: vi.fn(),
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

function createSupabaseMock(meeting: unknown) {
  const single = vi.fn().mockResolvedValue({ data: meeting, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { from, single };
}

async function runPreindexJob(data: Record<string, unknown>) {
  const { preindexMeetingRag } = await import("./preindex-meeting-rag");
  const step = {
    run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
  };

  return (preindexMeetingRag as { handler: (input: unknown) => Promise<unknown> })
    .handler({
      event: {
        id: "event-1",
        name: "meeting/rag.index",
        data,
      },
      step,
    });
}

describe("preindexMeetingRag", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createFunction.mockImplementation((_config, handler) => ({ handler }));
    mocks.ensureMeetingChunksIndexed.mockResolvedValue([{ id: "chunk-1" }]);
  });

  it("ensures transcript chunks for a completed meeting", async () => {
    const supabase = createSupabaseMock({
      id: "meeting-1",
      user_id: "user-1",
      status: "completed",
      transcript: "Transcricao completa",
    });
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    const result = await runPreindexJob({
      meetingId: "meeting-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      meetingId: "meeting-1",
      status: "indexed",
      chunks: 1,
    });
    expect(mocks.ensureMeetingChunksIndexed).toHaveBeenCalledWith({
      supabase,
      meeting: expect.objectContaining({
        id: "meeting-1",
        user_id: "user-1",
        transcript: "Transcricao completa",
      }),
      embedText: mocks.generateEmbedding,
    });
  });

  it("skips meetings that are not completed", async () => {
    const supabase = createSupabaseMock({
      id: "meeting-1",
      user_id: "user-1",
      status: "processing",
      transcript: "Transcricao parcial",
    });
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    const result = await runPreindexJob({
      meetingId: "meeting-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      meetingId: "meeting-1",
      status: "skipped",
      reason: "meeting_not_ready",
    });
    expect(mocks.ensureMeetingChunksIndexed).not.toHaveBeenCalled();
  });
});
