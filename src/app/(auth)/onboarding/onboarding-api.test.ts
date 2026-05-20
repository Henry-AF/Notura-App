import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureOnboardingBillingCustomer,
  startOnboardingCheckout,
  verifyOnboardingPayment,
} from "./onboarding-api";

describe("onboarding api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not treat accepted in-progress customer prewarm responses as ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 202 })
    );

    const result = await ensureOnboardingBillingCustomer();

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/customer/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "onboarding" }),
    });
  });

  it("returns the checkout redirect url for paid plans", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          checkoutUrl: "https://checkout.example.com/session",
        }),
        { status: 200 }
      )
    );

    const result = await startOnboardingCheckout("starter");

    expect(result).toEqual({
      checkoutUrl: "https://checkout.example.com/session",
      alreadyActive: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan: "pro",
        billingCycle: "monthly",
        source: "onboarding",
      }),
    });
  });

  it("keeps the user in the flow when the paid plan is already active", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ alreadyActive: true }), { status: 200 })
    );

    await expect(startOnboardingCheckout("pro")).resolves.toEqual({
      checkoutUrl: null,
      alreadyActive: true,
    });
  });

  it("throws when checkout succeeds without a redirect url", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );

    await expect(startOnboardingCheckout("pro")).rejects.toThrow(
      "Checkout não retornou URL de redirecionamento."
    );
  });

  it("verifies Stripe payments with the checkout session id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
      })
    );

    await verifyOnboardingPayment({
      provider: "stripe",
      sessionId: "cs_test_123",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: "cs_test_123" }),
    });
  });

  it("throws the API error when payment verification fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Pagamento pendente." }), {
        status: 409,
      })
    );

    await expect(
      verifyOnboardingPayment({
        provider: "abacatepay",
      })
    ).rejects.toThrow(
      "Pagamento pendente."
    );
  });
});
