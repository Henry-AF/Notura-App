import { beforeEach, describe, expect, it, vi } from "vitest";

function createOrderedQuery(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function createMeetingsQuery(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function createQuotaQuery(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe("meeting chat history list", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads a user's chats with meeting titles and today's AI quota", async () => {
    const chatQuery = createOrderedQuery({
      data: [
        {
          id: "chat-1",
          meeting_id: "meeting-1",
          user_id: "user-1",
          status: "completed",
          question: "Qual foi o prazo?",
          answer: "Sexta.",
          fallback_reason: null,
          model_confirmed: true,
          sources: [],
          error_message: null,
          created_at: "2026-05-05T10:00:00.000Z",
          completed_at: "2026-05-05T10:00:04.000Z",
        },
      ],
      error: null,
    });
    const meetingsQuery = createMeetingsQuery({
      data: [
        {
          id: "meeting-1",
          title: "QBR",
          client_name: "Acme",
          created_at: "2026-05-01T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const quotaQuery = createQuotaQuery({
      data: {
        used_count: 3,
        quota_limit: 10,
        usage_date: "2026-05-05",
      },
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => {
          if (table === "meeting_chats") return chatQuery;
          if (table === "meetings") return meetingsQuery;
          return quotaQuery;
        }),
      })),
    };

    const mod = await import("./list");
    const result = await mod.getMeetingChatHistoryForUser(
      supabase as never,
      "user-1",
      "2026-05-05"
    );

    expect(supabase.from).toHaveBeenCalledWith("meeting_chats");
    expect(supabase.from).toHaveBeenCalledWith("meetings");
    expect(supabase.from).toHaveBeenCalledWith("ai_usage_daily");
    expect(chatQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(meetingsQuery.in).toHaveBeenCalledWith("id", ["meeting-1"]);
    expect(quotaQuery.eq).toHaveBeenCalledWith("usage_date", "2026-05-05");
    expect(result).toEqual({
      quota: { used: 3, limit: 10, usageDate: "2026-05-05" },
      chats: [
        expect.objectContaining({
          id: "chat-1",
          meetingId: "meeting-1",
          meetingTitle: "QBR",
          meetingClientName: "Acme",
        }),
      ],
    });
  });

  it("returns an empty history and default quota when the user has no chats", async () => {
    const chatQuery = createOrderedQuery({ data: [], error: null });
    const quotaQuery = createQuotaQuery({ data: null, error: null });
    const supabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => (table === "meeting_chats" ? chatQuery : quotaQuery)),
      })),
    };

    const mod = await import("./list");
    const result = await mod.getMeetingChatHistoryForUser(
      supabase as never,
      "user-1",
      "2026-05-05"
    );

    expect(supabase.from).not.toHaveBeenCalledWith("meetings");
    expect(result).toEqual({
      quota: { used: 0, limit: 10, usageDate: "2026-05-05" },
      chats: [],
    });
  });
});
