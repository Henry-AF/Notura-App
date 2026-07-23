import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

function createServerClient(
  user: { id: string; email?: string | null } | null,
  error: { message: string } | null = null
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
    },
  };
}

function createOwnershipClient(options?: {
  row?: { id: string; user_id: string } | null;
  error?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options?.row ?? null,
    error: options?.error ?? null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { client: { from }, maybeSingle };
}

function respondOk(): Promise<Response> {
  return Promise.resolve(NextResponse.json({ ok: true }));
}

describe("withAuth — cookie session", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    createServerSupabase.mockReturnValue(createServerClient(null));
    createServiceRoleClient.mockReturnValue({});

    const mod = await import("./auth");
    const handler = mod.withAuth(respondOk);

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Não autenticado." });
  });

  it("injects auth into the wrapped handler", async () => {
    createServerSupabase.mockReturnValue(
      createServerClient({ id: "user-1", email: "user@example.com" })
    );

    const supabaseAdmin = { from: vi.fn() } as never;
    createServiceRoleClient.mockReturnValue(supabaseAdmin);

    const mod = await import("./auth");
    const handler = mod.withAuth((_request, { auth, params }) =>
      Promise.resolve(
        NextResponse.json({
          userId: auth.user.id,
          email: auth.user.email,
          hasRequestClient: typeof auth.supabase.auth.getUser === "function",
          hasAdminClient: auth.supabaseAdmin === supabaseAdmin,
          resourceId: params.id,
        })
      )
    );

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "meeting-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: "user-1",
      email: "user@example.com",
      hasRequestClient: true,
      hasAdminClient: true,
      resourceId: "meeting-1",
    });
  });

  it("resolves async route params before calling the wrapped handler", async () => {
    createServerSupabase.mockReturnValue(
      createServerClient({ id: "user-1", email: "user@example.com" })
    );

    createServiceRoleClient.mockReturnValue({ from: vi.fn() });

    const mod = await import("./auth");
    const handler = mod.withAuth<{ id: string }>((_request, { params }) =>
      Promise.resolve(NextResponse.json({ resourceId: params.id }))
    );

    const response = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ id: "meeting-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resourceId: "meeting-1" });
  });
});

describe("withAuth — Bearer token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("authenticates mobile requests with a Supabase Bearer access token", async () => {
    const supabase = createServerClient({
      id: "mobile-user",
      email: "mobile@example.com",
    });
    createServerSupabase.mockReturnValue(supabase);

    const supabaseAdmin = { from: vi.fn() } as never;
    createServiceRoleClient.mockReturnValue(supabaseAdmin);

    const mod = await import("./auth");
    const handler = mod.withAuth((_request, { auth }) =>
      Promise.resolve(
        NextResponse.json({
          userId: auth.user.id,
          email: auth.user.email,
        })
      )
    );

    const response = await handler(
      new Request("http://localhost/api/user/me", {
        headers: {
          Authorization: "Bearer mobile-access-token",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(supabase.auth.getUser).toHaveBeenCalledWith("mobile-access-token");
    expect(await response.json()).toEqual({
      userId: "mobile-user",
      email: "mobile@example.com",
    });
  });

  it("returns 401 when a Bearer token is rejected by Supabase", async () => {
    const supabase = createServerClient(null, { message: "Invalid JWT" });
    createServerSupabase.mockReturnValue(supabase);
    createServiceRoleClient.mockReturnValue({});

    const mod = await import("./auth");
    const handler = mod.withAuth(respondOk);

    const response = await handler(
      new Request("http://localhost/api/user/me", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(401);
    expect(supabase.auth.getUser).toHaveBeenCalledWith("invalid-token");
    expect(await response.json()).toEqual({ error: "Não autenticado." });
  });

  it.each([
    ["missing scheme keyword", "mobile-access-token"],
    ["wrong scheme", "Basic mobile-access-token"],
    ["extra parts", "Bearer mobile-access-token extra"],
    ["scheme with no token", "Bearer"],
  ])(
    "returns 401 when the Authorization header is malformed (%s)",
    async (_description, authorizationHeader) => {
      const supabase = createServerClient({ id: "mobile-user" });
      createServerSupabase.mockReturnValue(supabase);
      createServiceRoleClient.mockReturnValue({});

      const mod = await import("./auth");
      const handler = mod.withAuth(respondOk);

      const response = await handler(
        new Request("http://localhost/api/user/me", {
          headers: { Authorization: authorizationHeader },
        }),
        { params: Promise.resolve({}) }
      );

      expect(response.status).toBe(401);
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
      expect(await response.json()).toEqual({ error: "Não autenticado." });
    }
  );
});

describe("requireOwnership", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows ownership when the user owns the resource", async () => {
    const { client } = createOwnershipClient({
      row: { id: "meeting-1", user_id: "user-1" },
    });

    const mod = await import("./auth");

    await expect(
      mod.requireOwnership(client as never, "meetings", "meeting-1", "user-1")
    ).resolves.toBeUndefined();
  });

  it("returns 403 when the resource does not exist", async () => {
    const { client } = createOwnershipClient();

    const mod = await import("./auth");

    try {
      await mod.requireOwnership(
        client as never,
        "meetings",
        "missing-meeting",
        "user-1"
      );
      throw new Error("Expected requireOwnership to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
      expect(await (error as Response).json()).toEqual({ error: "Acesso negado." });
    }
  });

  it("returns 403 when the resource belongs to another user", async () => {
    const { client } = createOwnershipClient({
      row: { id: "meeting-1", user_id: "user-2" },
    });

    const mod = await import("./auth");

    try {
      await mod.requireOwnership(
        client as never,
        "meetings",
        "meeting-1",
        "user-1"
      );
      throw new Error("Expected requireOwnership to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
      expect(await (error as Response).json()).toEqual({ error: "Acesso negado." });
    }
  });
});
