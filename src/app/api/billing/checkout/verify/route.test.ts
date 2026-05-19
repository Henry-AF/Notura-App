import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const verifyBillingCheckout = vi.fn();

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: (_policy: unknown, handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/billing-gateway", () => ({
  verifyBillingCheckout,
}));

describe("POST /api/billing/checkout/verify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    verifyBillingCheckout.mockResolvedValue({
      provider: "stripe",
      success: true,
      plan: "pro",
      paymentStatus: "paid",
    });
  });

  it("verifies checkout through the billing gateway", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/checkout/verify", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs_123" }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provider: "stripe",
      success: true,
      plan: "pro",
      paymentStatus: "paid",
    });
    expect(verifyBillingCheckout).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "cs_123",
    });
  });
});
