import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const getOrCreateBillingAccount = vi.fn();
const updateBillingAutoRenew = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/billing", () => ({
  getOrCreateBillingAccount,
}));

vi.mock("@/lib/billing-gateway", () => ({
  updateBillingAutoRenew,
}));

describe("PATCH /api/billing/auto-renew", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getOrCreateBillingAccount.mockResolvedValue({
      stripe_subscription_id: "sub_123",
    });
    updateBillingAutoRenew.mockResolvedValue({
      provider: "stripe",
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "canceling",
    });
  });

  it("updates auto-renew through the active billing provider", async () => {
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/billing/auto-renew", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provider: "stripe",
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "canceling",
    });
    expect(updateBillingAutoRenew).toHaveBeenCalledWith({
      userId: "user-1",
      enabled: false,
      stripeSubscriptionId: "sub_123",
    });
  });

  it("uses AbacatePay auto-renew when it is the active fallback provider", async () => {
    getOrCreateBillingAccount.mockResolvedValueOnce({
      active_billing_provider: "abacatepay",
      stripe_subscription_id: "sub_123",
    });
    updateBillingAutoRenew.mockResolvedValueOnce({
      provider: "abacatepay",
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "active",
    });
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/billing/auto-renew", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(updateBillingAutoRenew).toHaveBeenCalledWith({
      userId: "user-1",
      enabled: false,
      stripeSubscriptionId: null,
    });
  });

  it("rejects non-boolean auto-renew payloads", async () => {
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/billing/auto-renew", {
        method: "PATCH",
        body: JSON.stringify({ enabled: "nope" }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(400);
    expect(updateBillingAutoRenew).not.toHaveBeenCalled();
  });
});
