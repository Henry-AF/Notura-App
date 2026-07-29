import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const verifyStripeTrialCheckout = vi.fn();

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: (_policy: unknown, handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/billing-gateway-providers", () => ({
  verifyStripeTrialCheckout,
}));

describe("POST /api/billing/trial/verify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    verifyStripeTrialCheckout.mockResolvedValue({
      provider: "stripe",
      success: true,
      plan: "team",
      paymentStatus: "no_payment_required",
    });
  });

  it("verifies the trial checkout session for the authenticated user", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/trial/verify", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs_123" }),
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provider: "stripe",
      success: true,
      plan: "team",
      paymentStatus: "no_payment_required",
    });
    expect(verifyStripeTrialCheckout).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "cs_123",
    });
  });

  it("rejects requests without a session id before hitting the gateway", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/trial/verify", {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(400);
    expect(verifyStripeTrialCheckout).not.toHaveBeenCalled();
  });

  it("surfaces the billing gateway error status and message", async () => {
    verifyStripeTrialCheckout.mockRejectedValueOnce(
      new BillingGatewayError("Sessão de checkout não é um trial válido.", 400)
    );
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/trial/verify", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs_123" }),
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Sessão de checkout não é um trial válido.",
    });
  });
});
