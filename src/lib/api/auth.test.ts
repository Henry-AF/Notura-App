import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createOptionalServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const createOptionalServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createOptionalServerSupabase,
  createServiceRoleClient,
  createOptionalServiceRoleClient,
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

describe("route auth helper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated user", async () => {
    createOptionalServerSupabase.mockReturnValue(createServerClient(null));
    createOptionalServiceRoleClient.mockReturnValue({});

    const mod = await import("./auth");
    const handler = mod.withAuth(async () => NextResponse.json({ ok: true }));

    const response = await handler(new Request("http://localhost"), {
      params: {},
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Não autenticado." });
  });

  it("injects auth into the wrapped handler", async () => {
    createOptionalServerSupabase.mockReturnValue(
      createServerClient({ id: "user-1", email: "user@example.com" })
    );

    const supabaseAdmin = { from: vi.fn() } as never;
    createOptionalServiceRoleClient.mockReturnValue(supabaseAdmin);

    const mod = await import("./auth");
    const handler = mod.withAuth(async (_request, { auth, params }) =>
      NextResponse.json({
        userId: auth.user.id,
        email: auth.user.email,
        hasRequestClient: typeof auth.supabase.auth.getUser === "function",
        hasAdminClient: auth.supabaseAdmin === supabaseAdmin,
        resourceId: params.id,
      })
    );

    const response = await handler(new Request("http://localhost"), {
      params: { id: "meeting-1" },
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

  it("authenticates mobile requests with a Supabase Bearer access token", async () => {
    const supabase = createServerClient({
      id: "mobile-user",
      email: "mobile@example.com",
    });
    createOptionalServerSupabase.mockReturnValue(supabase);

    const supabaseAdmin = { from: vi.fn() } as never;
    createOptionalServiceRoleClient.mockReturnValue(supabaseAdmin);

    const mod = await import("./auth");
    const handler = mod.withAuth(async (_request, { auth }) =>
      NextResponse.json({
        userId: auth.user.id,
        email: auth.user.email,
      })
    );

    const response = await handler(
      new Request("http://localhost/api/user/me", {
        headers: {
          Authorization: "Bearer mobile-access-token",
        },
      }),
      { params: {} }
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
    createOptionalServerSupabase.mockReturnValue(supabase);
    createOptionalServiceRoleClient.mockReturnValue({});

    const mod = await import("./auth");
    const handler = mod.withAuth(async () => NextResponse.json({ ok: true }));

    const response = await handler(
      new Request("http://localhost/api/user/me", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      }),
      { params: {} }
    );

    expect(response.status).toBe(401);
    expect(supabase.auth.getUser).toHaveBeenCalledWith("invalid-token");
    expect(await response.json()).toEqual({ error: "Não autenticado." });
  });

  it("allows ownership when the user owns the resource", async () => {
    const { client } = createOwnershipClient({
      row: { id: "meeting-1", user_id: "user-1" },
    });

    const mod = await import("./auth");

    await expect(
      mod.requireOwnership(
        client as never,
        "meetings",
        "meeting-1",
        "user-1"
      )
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
