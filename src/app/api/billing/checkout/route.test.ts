import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";

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

  it("creates checkout through the billing gateway with the requested billing cycle intent", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: "pro",
          source: "settings",
          billingCycle: "yearly",
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
      billingCycle: "yearly",
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

  it("returns support contact details when a previous paid checkout was not applied", async () => {
    createBillingCheckout.mockRejectedValueOnce(
      new BillingGatewayError(
        "Recebemos o pagamento da sua assinatura, mas o plano ainda nao foi aplicado automaticamente.",
        409,
        "payment_received_plan_pending"
      )
    );
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "pro", source: "settings" }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      errorCode: "payment_received_plan_pending",
      supportWhatsappUrl: expect.stringContaining("wa.me/5513996495858"),
    });
  });
});
