import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;

let currentAuth: typeof authContext | null = authContext;

const createServiceRoleClient = vi.fn();
const logStructured = vi.fn();
const createTraceId = vi.fn(() => "trace-1");

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (request: Request, context: { params: Record<string, string> }) => {
      if (!currentAuth) {
        return new Response(JSON.stringify({ error: "Não autenticado." }), {
          status: 401,
        });
      }
      return handler(request, { ...context, auth: currentAuth });
    };
  },
}));

vi.mock("@/lib/observability", () => ({
  logStructured,
  createTraceId,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/integration-interest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/integration-interest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAuth = authContext;
  });

  it("upserts the channel scoped to the authenticated user", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const mod = await import("./route");
    const response = await mod.POST(jsonRequest({ channel: "zoom" }), { params: {} });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ channel: "zoom" });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", channel: "zoom" },
      { onConflict: "user_id,channel", ignoreDuplicates: true }
    );
    expect(logStructured).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        event: "integration.interest.captured",
        userId: "user-1",
        channel: "zoom",
      })
    );
  });

  it("ignores extra fields on the body and never forwards them to the upsert", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const mod = await import("./route");
    await mod.POST(
      jsonRequest({ channel: "chrome_extension", user_id: "someone-else" }),
      { params: {} }
    );

    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", channel: "chrome_extension" },
      { onConflict: "user_id,channel", ignoreDuplicates: true }
    );
  });

  it("returns 400 and never touches the database for an invalid channel", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const mod = await import("./route");
    const response = await mod.POST(jsonRequest({ channel: "slack" }), { params: {} });

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
    expect(logStructured).not.toHaveBeenCalled();
  });

  it("is idempotent: two identical requests both resolve to a single upsert call each with the same key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    createServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const mod = await import("./route");
    await mod.POST(jsonRequest({ channel: "zoom" }), { params: {} });
    await mod.POST(jsonRequest({ channel: "zoom" }), { params: {} });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0]).toEqual(upsert.mock.calls[1]);
    expect(upsert.mock.calls[0][1]).toEqual(
      expect.objectContaining({ onConflict: "user_id,channel", ignoreDuplicates: true })
    );
  });

  it("returns 401 when the request is not authenticated", async () => {
    currentAuth = null;
    const mod = await import("./route");
    const response = await mod.POST(jsonRequest({ channel: "zoom" }), { params: {} });

    expect(response.status).toBe(401);
  });
});

describe("GET /api/integration-interest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAuth = authContext;
  });

  it("returns the channels registered by the authenticated user", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ channel: "zoom" }, { channel: "chrome_extension" }],
      error: null,
    });
    createServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })),
    });

    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/integration-interest"),
      { params: {} }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      channels: ["zoom", "chrome_extension"],
    });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns 401 when the request is not authenticated", async () => {
    currentAuth = null;
    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/integration-interest"),
      { params: {} }
    );

    expect(response.status).toBe(401);
  });
});
