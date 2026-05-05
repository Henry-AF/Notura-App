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

function createOwnershipQuery(ownsChat: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: ownsChat ? { id: "chat-1", user_id: "user-1" } : null,
    error: null,
  });
  const chain = {
    eq: vi.fn(() => chain),
    maybeSingle,
  };
  return chain;
}

function createDeleteQuery(error: unknown = null) {
  const chain = {
    eq: vi.fn(() => chain),
    then: undefined,
  } as {
    eq: ReturnType<typeof vi.fn>;
    then?: never;
  };
  chain.eq.mockImplementation(() => chain);
  return {
    chain,
    resolve: vi.fn().mockResolvedValue({ error }),
  };
}

function createAdminClient(options?: { ownsChat?: boolean; deleteError?: unknown }) {
  const ownershipQuery = createOwnershipQuery(options?.ownsChat ?? true);
  const deleteQuery = createDeleteQuery(options?.deleteError ?? null);
  const from = vi.fn(() => ({
    select: vi.fn(() => ownershipQuery),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: options?.deleteError ?? null }),
      })),
    })),
  }));

  return { from, ownershipQuery, deleteQuery };
}

describe("DELETE /api/meeting-chats/[chatId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServerSupabase.mockReturnValue(createServerClient());
  });

  it("returns 403 when the chat does not belong to the user", async () => {
    createServiceRoleClient.mockReturnValue(createAdminClient({ ownsChat: false }));

    const mod = await import("./route");
    const response = await mod.DELETE(new Request("http://localhost") as NextRequest, {
      params: { chatId: "chat-1" },
    });

    expect(response.status).toBe(403);
  });

  it("deletes an owned chat", async () => {
    const admin = createAdminClient();
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.DELETE(new Request("http://localhost") as NextRequest, {
      params: { chatId: "chat-1" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(admin.from).toHaveBeenCalledWith("meeting_chats");
  });

  it("returns 500 when deletion fails after ownership is confirmed", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({ deleteError: { message: "constraint failed" } })
    );

    const mod = await import("./route");
    const response = await mod.DELETE(new Request("http://localhost") as NextRequest, {
      params: { chatId: "chat-1" },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Erro ao excluir chat.",
    });
  });
});
