import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: "chat-1", status: "processing" },
    error: null,
  });
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({ single: insertSingle })),
  }));
  const from = vi.fn((table: string) => {
    if (table === "meeting_chats") return { insert };

    return {
      select: vi.fn((columns: string) => ({
        eq: vi.fn(() =>
          columns === "id, user_id" ? { maybeSingle } : { single: meetingSingle }
        ),
      })),
    };
  });

  return { from, insert };
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

  it("creates a processing chat and enqueues the answer job", async () => {
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
    expect(admin.insert).toHaveBeenCalledWith({
      meeting_id: "meeting-1",
      user_id: "user-1",
      question: "Qual foi o prazo?",
      status: "processing",
    });
    expect(inngestSend).toHaveBeenCalledWith({
      name: "meeting/chat.answer",
      data: {
        chatId: "chat-1",
        meetingId: "meeting-1",
        userId: "user-1",
      },
    });
  });
});
