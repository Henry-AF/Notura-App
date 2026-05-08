import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AI_MEETING_CHAT_DAILY_QUOTA_FEATURE = "meeting_chat";
const AI_MEETING_CHAT_DAILY_QUOTA_LIMIT = 10;

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const inngestSend = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: inngestSend,
  },
}));

function createServerClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  };
}

function createAdminClient(options?: {
  ownsMeeting?: boolean;
  meetingStatus?: string;
  transcript?: string | null;
  chatRpcError?: { code?: string; message: string };
  chatRows?: Array<{
    id: string;
    meeting_id: string;
    status: string;
    question: string;
    answer: string | null;
    fallback_reason: string | null;
    model_confirmed: boolean | null;
    sources: unknown[];
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
}) {
  const ownsMeeting = options?.ownsMeeting ?? true;
  const meetingStatus = options?.meetingStatus ?? "completed";
  const transcript =
    options && "transcript" in options ? options.transcript : "Transcricao salva";

  const maybeSingle = vi.fn().mockResolvedValue({
    data: ownsMeeting ? { id: "meeting-1", user_id: "user-1" } : null,
    error: null,
  });
  const meetingSingle = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", status: meetingStatus, transcript },
    error: null,
  });
  const rpcSingle = vi.fn().mockResolvedValue({
    data: options?.chatRpcError
      ? null
      : { chat_id: "chat-1", status: "processing" },
    error: options?.chatRpcError ?? null,
  });
  const chatRows = options?.chatRows ?? [];
  const chatsOrder = vi.fn().mockResolvedValue({
    data: chatRows,
    error: null,
  });
  const outboxUpdates: unknown[] = [];
  const outboxStatusIn = vi.fn().mockResolvedValue({ error: null });
  const outboxChatEq = vi.fn(() => ({ in: outboxStatusIn }));
  const outboxUpdate = vi.fn((payload: unknown) => {
    outboxUpdates.push(payload);
    return { eq: outboxChatEq };
  });
  const rpc = vi.fn(() => ({
    single: rpcSingle,
  }));
  const from = vi.fn((table: string) => {
    if (table === "meeting_chats") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                order: chatsOrder,
              })),
            })),
          })),
        })),
      };
    }

    if (table === "meeting_chat_outbox") {
      return {
        update: outboxUpdate,
      };
    }

    return {
      select: vi.fn((columns: string) => ({
        eq: vi.fn(() =>
          columns === "id, user_id" ? { maybeSingle } : { single: meetingSingle }
        ),
      })),
    };
  });

  return { from, rpc, outboxUpdates, outboxChatEq, outboxStatusIn };
}

function createRequest(question: string) {
  return new Request("http://localhost/api/meetings/meeting-1/chats", {
    method: "POST",
    body: JSON.stringify({ question }),
  }) as NextRequest;
}

describe("POST /api/meetings/[id]/chats", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServerSupabase.mockReturnValue(createServerClient());
    inngestSend.mockResolvedValue(undefined);
  });

  it("returns 403 when the meeting does not belong to the user", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({ ownsMeeting: false })
    );

    const mod = await import("./route");
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(403);
  });

  it("lists archived chats for the owned meeting", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({
        chatRows: [
          {
            id: "chat-2",
            meeting_id: "meeting-1",
            status: "completed",
            question: "Quais foram os proximos passos?",
            answer: "Alinhar com vendas.",
            fallback_reason: null,
            model_confirmed: true,
            sources: [],
            error_message: null,
            created_at: "2026-05-07T11:00:00.000Z",
            completed_at: "2026-05-07T11:00:04.000Z",
          },
        ],
      })
    );

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost/api/meetings/meeting-1/chats") as NextRequest, {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "chat-2",
        status: "completed",
        question: "Quais foram os proximos passos?",
        answer: "Alinhar com vendas.",
        fallbackReason: null,
        modelConfirmed: true,
        sources: [],
        errorMessage: null,
        createdAt: "2026-05-07T11:00:00.000Z",
        completedAt: "2026-05-07T11:00:04.000Z",
      },
    ]);
  });

  it("rejects long questions", async () => {
    createServiceRoleClient.mockReturnValue(createAdminClient());

    const mod = await import("./route");
    const response = await mod.POST(createRequest("a".repeat(501)), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "question_too_long" });
  });

  it("rejects meetings that are not completed", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({ meetingStatus: "processing" })
    );

    const mod = await import("./route");
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "meeting_not_ready" });
  });

  it("creates a processing chat with an outbox row and dispatches the answer immediately", async () => {
    const admin = createAdminClient();
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      chatId: "chat-1",
      status: "processing",
    });
    expect(admin.rpc).toHaveBeenCalledWith("create_meeting_chat_with_outbox", {
      p_ai_daily_quota_limit: AI_MEETING_CHAT_DAILY_QUOTA_LIMIT,
      p_ai_feature: AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
      p_meeting_id: "meeting-1",
      p_question: "Qual foi o prazo?",
      p_user_id: "user-1",
    });
    expect(inngestSend).toHaveBeenCalledTimes(1);
    expect(inngestSend).toHaveBeenCalledWith({
      name: "meeting/chat.answer",
      data: {
        chatId: "chat-1",
        meetingId: "meeting-1",
        userId: "user-1",
      },
    });
    expect(admin.outboxUpdates).toContainEqual(
      expect.objectContaining({
        status: "sent",
        last_error: null,
      })
    );
    expect(admin.outboxChatEq).toHaveBeenCalledWith("chat_id", "chat-1");
    expect(admin.outboxStatusIn).toHaveBeenCalledWith("status", [
      "pending",
      "processing",
    ]);
  });

  it("returns 403 when the daily AI chat quota is exhausted", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({
        chatRpcError: {
          code: "AI001",
          message: "ai_chat_daily_quota_exceeded",
        },
      })
    );

    const mod = await import("./route");
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "ai_chat_daily_quota_exceeded",
      quotaLimit: 10,
    });
  });

  it("kicks the outbox dispatcher when the direct answer dispatch fails", async () => {
    const admin = createAdminClient();
    createServiceRoleClient.mockReturnValue(admin);
    inngestSend
      .mockRejectedValueOnce(new Error("Inngest unavailable"))
      .mockResolvedValueOnce(undefined);

    const mod = await import("./route");
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      chatId: "chat-1",
      status: "processing",
    });
    expect(admin.rpc).toHaveBeenCalledWith("create_meeting_chat_with_outbox", {
      p_ai_daily_quota_limit: AI_MEETING_CHAT_DAILY_QUOTA_LIMIT,
      p_ai_feature: AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
      p_meeting_id: "meeting-1",
      p_question: "Qual foi o prazo?",
      p_user_id: "user-1",
    });
    expect(inngestSend).toHaveBeenNthCalledWith(1, {
      name: "meeting/chat.answer",
      data: {
        chatId: "chat-1",
        meetingId: "meeting-1",
        userId: "user-1",
      },
    });
    expect(inngestSend).toHaveBeenNthCalledWith(2, {
      name: "meeting/chat.outbox.dispatch",
      data: {
        meetingId: "meeting-1",
        userId: "user-1",
      },
    });
    expect(admin.outboxUpdates).toEqual([]);
  });

  it("still returns 202 when direct dispatch and the fallback kick fail after the outbox commit", async () => {
    const admin = createAdminClient();
    createServiceRoleClient.mockReturnValue(admin);
    inngestSend.mockRejectedValue(new Error("Inngest unavailable"));

    const mod = await import("./route");
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      chatId: "chat-1",
      status: "processing",
    });
    expect(inngestSend).toHaveBeenCalledTimes(2);
    expect(admin.outboxUpdates).toEqual([]);
  });

  it("rate limits chat creation to two requests per minute per user", async () => {
    createServiceRoleClient.mockReturnValue(createAdminClient());

    const mod = await import("./route");
    await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });
    await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });
    const response = await mod.POST(createRequest("Qual foi o prazo?"), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Muitas requisições. Tente novamente em instantes.",
      code: "rate_limited",
    });
    expect(response.headers.get("x-ratelimit-limit")).toBe("2");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("retry-after")).toBeTruthy();
  });
});
