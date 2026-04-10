import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authContext = {
  user: { id: "user-1" },
  supabase: {},
  supabaseAdmin: {},
} as never;

const getOwnedMeetingsForAuth = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (
      request: Request,
      context: { params: Record<string, string> }
    ) => {
      return handler(request, { ...context, auth: authContext });
    };
  },
}));

vi.mock("@/lib/meetings/list", () => ({
  getOwnedMeetingsForAuth,
}));

describe("GET /api/meetings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns meetings from the shared lib helper", async () => {
    getOwnedMeetingsForAuth.mockResolvedValue([
      {
        id: "meeting-1",
        title: "Kickoff",
        client_name: "Acme",
        created_at: "2026-04-10T10:00:00.000Z",
        status: "completed",
      },
    ]);

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings"),
      { params: {} } as never
    );

    expect(getOwnedMeetingsForAuth).toHaveBeenCalledWith(authContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      meetings: [
        {
          id: "meeting-1",
          title: "Kickoff",
          clientName: "Acme",
          createdAt: "2026-04-10T10:00:00.000Z",
          status: "completed",
        },
      ],
    });
  });

  it("returns 500 when the shared helper fails", async () => {
    getOwnedMeetingsForAuth.mockRejectedValue(new Error("db is down"));

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings"),
      { params: {} } as never
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Erro ao carregar reuniões.",
    });
  });
});
