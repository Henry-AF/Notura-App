import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOwnedMeetingChatHistory = vi.fn();

vi.mock("@/lib/meeting-chats/list", () => ({
  getOwnedMeetingChatHistory,
}));

describe("ai chats page api", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T15:00:00.000Z"));
    getOwnedMeetingChatHistory.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads chat history from the shared server helper and maps meeting filter options", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("ai chats page should not fetch /api internally"));

    getOwnedMeetingChatHistory.mockResolvedValue({
      quota: { used: 4, limit: 10, usageDate: "2026-05-05" },
      chats: [
        {
          id: "chat-1",
          meetingId: "meeting-1",
          meetingTitle: "QBR",
          meetingClientName: "Acme",
          meetingCreatedAt: "2026-05-01T10:00:00.000Z",
          status: "completed",
          question: "Qual foi o prazo?",
          answer: "O prazo foi sexta.",
          fallbackReason: null,
          modelConfirmed: true,
          sources: [],
          errorMessage: null,
          createdAt: "2026-05-05T14:30:00.000Z",
          completedAt: "2026-05-05T14:30:04.000Z",
        },
        {
          id: "chat-2",
          meetingId: "meeting-1",
          meetingTitle: "QBR",
          meetingClientName: "Acme",
          meetingCreatedAt: "2026-05-01T10:00:00.000Z",
          status: "completed",
          question: "Quem ficou responsavel?",
          answer: null,
          fallbackReason: "not_confirmed_by_model",
          modelConfirmed: false,
          sources: [],
          errorMessage: null,
          createdAt: "2026-05-04T14:30:00.000Z",
          completedAt: "2026-05-04T14:30:04.000Z",
        },
        {
          id: "chat-3",
          meetingId: "meeting-2",
          meetingTitle: null,
          meetingClientName: null,
          meetingCreatedAt: "2026-04-30T10:00:00.000Z",
          status: "failed",
          question: "Resumo?",
          answer: null,
          fallbackReason: "provider_error",
          modelConfirmed: false,
          sources: [],
          errorMessage: "Gemini indisponivel",
          createdAt: "2026-05-03T14:30:00.000Z",
          completedAt: "2026-05-03T14:30:04.000Z",
        },
      ],
    });

    const mod = await import("./ai-chats-api");
    const result = await mod.fetchAiChatsPageData();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getOwnedMeetingChatHistory).toHaveBeenCalledTimes(1);
    expect(result.quota).toEqual({
      used: 4,
      limit: 10,
      remaining: 6,
      percentage: 40,
      usageDate: "2026-05-05",
    });
    expect(result.meetingOptions).toEqual([
      { id: "meeting-1", label: "QBR", count: 2 },
      { id: "meeting-2", label: "Reunião sem título", count: 1 },
    ]);
    expect(result.chats[0]).toEqual(
      expect.objectContaining({
        id: "chat-1",
        meetingTitle: "QBR",
        displayDate: "30 min atrás",
        rawDate: "2026-05-05T14:30:00.000Z",
      })
    );
  });

  it("filters chats by meeting while keeping all chats available by default", async () => {
    const mod = await import("./ai-chats-api");
    const chats = [
      { id: "chat-1", meetingId: "meeting-1" },
      { id: "chat-2", meetingId: "meeting-2" },
    ] as import("./ai-chats-api").AiChatItem[];

    expect(mod.filterAiChatsByMeeting(chats, "all")).toEqual(chats);
    expect(mod.filterAiChatsByMeeting(chats, "meeting-2")).toEqual([
      { id: "chat-2", meetingId: "meeting-2" },
    ]);
  });
});
