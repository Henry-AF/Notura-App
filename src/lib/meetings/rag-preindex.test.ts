import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
  ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
  TRANSCRIPT_CHUNKING_VERSION,
} from "./rag";

const mocks = vi.hoisted(() => ({
  inngestSend: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: mocks.inngestSend,
  },
}));

vi.mock("@/lib/observability", () => ({
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

function createChunksLookupClient(data: unknown[], error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const query = {
    eq: vi.fn(),
    limit,
  };
  query.eq.mockReturnValue(query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));

  return { supabase: { from }, from, select, eq: query.eq, limit };
}

const completedMeeting = {
  id: "meeting-1",
  user_id: "user-1",
  status: "completed",
  transcript: "Transcricao completa",
};

describe("prewarmMeetingRagIndex", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.inngestSend.mockResolvedValue(undefined);
  });

  it("dispatches RAG indexing when a completed meeting has no active chunks", async () => {
    const { prewarmMeetingRagIndex } = await import("./rag-preindex");
    const { supabase, from, eq, limit } = createChunksLookupClient([]);

    const result = await prewarmMeetingRagIndex({
      supabase: supabase as never,
      meeting: completedMeeting,
      userId: "user-1",
      route: "/api/meetings/meeting-1",
    });

    expect(result).toBe("dispatched");
    expect(from).toHaveBeenCalledWith("meeting_transcript_chunks");
    expect(eq).toHaveBeenCalledWith("meeting_id", "meeting-1");
    expect(eq).toHaveBeenCalledWith(
      "embedding_model",
      ACTIVE_TRANSCRIPT_EMBEDDING_MODEL
    );
    expect(eq).toHaveBeenCalledWith(
      "embedding_dimensions",
      ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS
    );
    expect(eq).toHaveBeenCalledWith("chunking_version", TRANSCRIPT_CHUNKING_VERSION);
    expect(limit).toHaveBeenCalledWith(1);
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "meeting/rag.index",
      data: {
        meetingId: "meeting-1",
        userId: "user-1",
      },
    });
  });

  it("does not dispatch when active chunks already exist", async () => {
    const { prewarmMeetingRagIndex } = await import("./rag-preindex");
    const { supabase } = createChunksLookupClient([{ id: "chunk-1" }]);

    const result = await prewarmMeetingRagIndex({
      supabase: supabase as never,
      meeting: completedMeeting,
      userId: "user-1",
      route: "/api/meetings/meeting-1",
    });

    expect(result).toBe("already_indexed");
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("skips meetings that are not ready for RAG indexing", async () => {
    const { prewarmMeetingRagIndex } = await import("./rag-preindex");
    const { supabase, from } = createChunksLookupClient([]);

    const result = await prewarmMeetingRagIndex({
      supabase: supabase as never,
      meeting: { ...completedMeeting, status: "processing" },
      userId: "user-1",
      route: "/api/meetings/meeting-1",
    });

    expect(result).toBe("skipped");
    expect(from).not.toHaveBeenCalled();
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("logs and keeps the caller successful when the prewarm check fails", async () => {
    const { prewarmMeetingRagIndex } = await import("./rag-preindex");
    const { supabase } = createChunksLookupClient([], { message: "db unavailable" });

    const result = await prewarmMeetingRagIndex({
      supabase: supabase as never,
      meeting: completedMeeting,
      userId: "user-1",
      route: "/api/meetings/meeting-1",
    });

    expect(result).toBe("failed");
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "warn",
      expect.objectContaining({
        event: "meeting.rag.preindex.dispatch_failed",
        route: "/api/meetings/meeting-1",
        status: 202,
      })
    );
  });
});
