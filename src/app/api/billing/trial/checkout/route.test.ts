import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const createStripeTrialCheckout = vi.fn();

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: (_policy: unknown, handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/billing-gateway-providers", () => ({
  createStripeTrialCheckout,
}));

describe("POST /api/billing/trial/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createStripeTrialCheckout.mockResolvedValue({
      provider: "stripe",
      checkoutUrl: "https://checkout.stripe.com/trial-session",
    });
  });

  it("creates a trial checkout for the authenticated user", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/trial/checkout", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      provider: "stripe",
      checkoutUrl: "https://checkout.stripe.com/trial-session",
    });
    expect(createStripeTrialCheckout).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "ana@example.com",
      requestOrigin: "http://localhost",
    });
  });

  it("surfaces the billing gateway error status and message", async () => {
    createStripeTrialCheckout.mockRejectedValueOnce(
      new BillingGatewayError("Você já usou seu período de teste gratuito.", 409)
    );
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/trial/checkout", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Você já usou seu período de teste gratuito.",
    });
  });
});
