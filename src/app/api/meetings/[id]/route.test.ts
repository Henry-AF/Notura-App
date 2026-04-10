import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
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

describe("GET /api/meetings/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
