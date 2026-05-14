import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const createBillingCheckout = vi.fn();

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: (_policy: unknown, handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/billing-gateway", () => ({
  createBillingCheckout,
}));

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createBillingCheckout.mockResolvedValue({
      provider: "stripe",
      checkoutUrl: "https://checkout.stripe.com/session",
    });
  });

  it("creates checkout through the billing gateway", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: "pro",
          source: "settings",
        }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provider: "stripe",
      checkoutUrl: "https://checkout.stripe.com/session",
    });
    expect(createBillingCheckout).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "pro",
      source: "settings",
      requestOrigin: "http://localhost",
    });
  });

  it("rejects free checkout requests before hitting providers", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "free" }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(400);
    expect(createBillingCheckout).not.toHaveBeenCalled();
  });
});
