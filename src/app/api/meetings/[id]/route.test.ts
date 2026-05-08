import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const deleteOwnedMeetingForAuth = vi.fn();
const prewarmMeetingRagIndex = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/meetings/delete", () => ({
  deleteOwnedMeetingForAuth,
}));

vi.mock("@/lib/meetings/rag-preindex", () => ({
  prewarmMeetingRagIndex,
}));

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

function createMissingMeetingAdminClient() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from };
}

function createOwnedMeetingAdminClient() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", user_id: "user-1" },
    error: null,
  });
  const single = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      user_id: "user-1",
      status: "completed",
      transcript: "Transcricao completa",
      tasks: [],
      decisions: [],
      open_items: [],
    },
    error: null,
  });
  const select = vi.fn((columns: string) => ({
    eq: vi.fn(() =>
      columns === "id, user_id" ? { maybeSingle } : { single }
    ),
  }));
  const from = vi.fn(() => ({ select }));

  return { from };
}

describe("GET /api/meetings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prewarmMeetingRagIndex.mockResolvedValue("dispatched");
  });

  it("returns 403 when the meeting does not belong to the authenticated user", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createMissingMeetingAdminClient());

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "missing-meeting" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Acesso negado." });
  });

  it("prewarms the meeting RAG index when returning a meeting detail", async () => {
    const admin = createOwnedMeetingAdminClient();
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(200);
    expect(prewarmMeetingRagIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase: admin,
        userId: "user-1",
        route: "/api/meetings/meeting-1",
        meeting: expect.objectContaining({
          id: "meeting-1",
          status: "completed",
          transcript: "Transcricao completa",
        }),
      })
    );
  });
});

describe("PATCH /api/meetings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 403 when trying to edit a meeting that does not belong to the user", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createMissingMeetingAdminClient());

    const mod = await import("./route");
    const response = await mod.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          title: "Novo título",
          clientName: "Nova empresa",
          meetingDate: "2026-04-10",
        }),
      }) as NextRequest,
      { params: { id: "missing-meeting" } }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Acesso negado." });
  });
});

describe("DELETE /api/meetings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns success when the meeting deletion succeeds", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue({});
    deleteOwnedMeetingForAuth.mockResolvedValue({
      success: true,
      alreadyDeleted: false,
    });

    const mod = await import("./route");
    const response = await mod.DELETE(
      new Request("http://localhost", { method: "DELETE" }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(deleteOwnedMeetingForAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "user-1" }),
      }),
      "meeting-1"
    );
  });

  it("returns success when the meeting was already deleted", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue({});
    deleteOwnedMeetingForAuth.mockResolvedValue({
      success: true,
      alreadyDeleted: true,
    });

    const mod = await import("./route");
    const response = await mod.DELETE(
      new Request("http://localhost", { method: "DELETE" }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it("returns 500 when the deletion helper fails unexpectedly", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue({});
    deleteOwnedMeetingForAuth.mockRejectedValue(
      new Error("Falha ao excluir reunião.")
    );

    const mod = await import("./route");
    const response = await mod.DELETE(
      new Request("http://localhost", { method: "DELETE" }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Erro interno do servidor.",
    });
  });
});
