import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;

const createServiceRoleClient = vi.fn();
const setAbacatePayAutoRenew = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (
      request: Request,
      context: { params: Record<string, string> }
    ) => handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/billing", () => ({
  setAbacatePayAutoRenew,
}));

describe("PATCH /api/abacatepay/auto-renew", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServiceRoleClient.mockReturnValue({ db: true });
    setAbacatePayAutoRenew.mockResolvedValue({
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-05-27T12:00:00.000Z",
      renewalStatus: "active",
    });
  });

  it("updates the authenticated user's auto-renew preference", async () => {
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/abacatepay/auto-renew", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-05-27T12:00:00.000Z",
      renewalStatus: "active",
    });
    expect(setAbacatePayAutoRenew).toHaveBeenCalledWith(
      "user-1",
      false,
      { db: true }
    );
  });

  it("rejects invalid payloads", async () => {
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/abacatepay/auto-renew", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: "false" }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(400);
    expect(setAbacatePayAutoRenew).not.toHaveBeenCalled();
  });
});
