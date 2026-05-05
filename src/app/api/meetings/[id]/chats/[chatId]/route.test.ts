import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
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

function createEqChain(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const chain = {
    eq: vi.fn(() => chain),
    maybeSingle,
  };
  return chain;
}

function createAdminClient(options?: { ownsMeeting?: boolean; chat?: unknown }) {
  const ownsMeeting = options?.ownsMeeting ?? true;
  const meetingOwnership = createEqChain({
    data: ownsMeeting ? { id: "meeting-1", user_id: "user-1" } : null,
    error: null,
  });
  const chatQuery = createEqChain({
    data:
      options && "chat" in options
        ? options.chat
        : {
            id: "chat-1",
            status: "completed",
            question: "Qual foi o prazo?",
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
            error_message: null,
            created_at: "2026-04-30T12:00:00.000Z",
            completed_at: "2026-04-30T12:00:03.000Z",
          },
    error: null,
  });

  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) =>
      table === "meetings" && columns === "id, user_id"
        ? meetingOwnership
        : chatQuery
    ),
  }));

  return { from };
}

describe("GET /api/meetings/[id]/chats/[chatId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServerSupabase.mockReturnValue(createServerClient());
  });

  it("returns 403 when the meeting does not belong to the user", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({ ownsMeeting: false })
    );

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "meeting-1", chatId: "chat-1" },
    });

    expect(response.status).toBe(403);
  });

  it("returns 404 when the chat is not scoped to the meeting and user", async () => {
    createServiceRoleClient.mockReturnValue(createAdminClient({ chat: null }));

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "meeting-1", chatId: "chat-1" },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Chat não encontrado." });
  });

  it("maps the stored chat response to the API contract", async () => {
    createServiceRoleClient.mockReturnValue(createAdminClient());

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "meeting-1", chatId: "chat-1" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "chat-1",
      status: "completed",
      question: "Qual foi o prazo?",
      answer: "O prazo foi sexta.",
      fallbackReason: null,
      modelConfirmed: true,
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
      errorMessage: null,
      createdAt: "2026-04-30T12:00:00.000Z",
      completedAt: "2026-04-30T12:00:03.000Z",
    });
  });
});
