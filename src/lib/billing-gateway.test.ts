import { beforeEach, describe, expect, it, vi } from "vitest";

const createStripeCheckout = vi.fn();
const ensureStripeCustomer = vi.fn();
const setStripeAutoRenew = vi.fn();
const createAbacatePayCheckout = vi.fn();
const ensureAbacatePayCustomer = vi.fn();
const setAbacatePayAutoRenew = vi.fn();

vi.mock("@/lib/billing-gateway-providers", () => ({
  createStripeCheckout,
  ensureStripeCustomer,
  setStripeAutoRenew,
  createAbacatePayCheckout,
  ensureAbacatePayCustomer,
  setAbacatePayAutoRenew,
}));

describe("billing gateway", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createStripeCheckout.mockResolvedValue({
      provider: "stripe",
      checkoutUrl: "https://stripe.example.com/session",
    });
    ensureStripeCustomer.mockResolvedValue({
      provider: "stripe",
      status: "ready",
      customerId: "cus_123",
    });
    setStripeAutoRenew.mockResolvedValue({
      provider: "stripe",
      autoRenewEnabled: true,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "active",
    });
    createAbacatePayCheckout.mockResolvedValue({
      provider: "abacatepay",
      checkoutUrl: "https://abacatepay.example.com/session",
    });
    ensureAbacatePayCustomer.mockResolvedValue({
      provider: "abacatepay",
      status: "ready",
      customerId: "customer-1",
    });
    setAbacatePayAutoRenew.mockResolvedValue({
      provider: "abacatepay",
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "active",
    });
  });

  it("creates checkout with Stripe as the primary gateway", async () => {
    const { createBillingCheckout } = await import("./billing-gateway");

    const result = await createBillingCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "pro",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "monthly",
    });

    expect(result).toEqual({
      provider: "stripe",
      checkoutUrl: "https://stripe.example.com/session",
    });
    expect(createStripeCheckout).toHaveBeenCalledOnce();
    expect(createAbacatePayCheckout).not.toHaveBeenCalled();
  });

  it("falls back to AbacatePay checkout when Stripe fails", async () => {
    createStripeCheckout.mockRejectedValueOnce(new Error("stripe unavailable"));

    const { createBillingCheckout } = await import("./billing-gateway");

    const result = await createBillingCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "team",
      source: "onboarding",
      requestOrigin: "http://localhost",
      billingCycle: "yearly",
    });

    expect(result).toEqual({
      provider: "abacatepay",
      checkoutUrl: "https://abacatepay.example.com/session",
    });
    expect(createStripeCheckout).toHaveBeenCalledOnce();
    expect(createAbacatePayCheckout).toHaveBeenCalledOnce();
  });

  it("prewarms a Stripe customer before using the fallback provider", async () => {
    ensureStripeCustomer.mockRejectedValueOnce(new Error("stripe unavailable"));

    const { ensureBillingCustomer } = await import("./billing-gateway");

    const result = await ensureBillingCustomer({
      userId: "user-1",
      userEmail: "ana@example.com",
      source: "settings",
    });

    expect(result).toEqual({
      provider: "abacatepay",
      status: "ready",
      customerId: "customer-1",
    });
    expect(ensureStripeCustomer).toHaveBeenCalledOnce();
    expect(ensureAbacatePayCustomer).toHaveBeenCalledOnce();
  });

  it("updates Stripe auto-renew when a Stripe subscription exists", async () => {
    const { updateBillingAutoRenew } = await import("./billing-gateway");

    const result = await updateBillingAutoRenew({
      userId: "user-1",
      enabled: true,
      stripeSubscriptionId: "sub_123",
    });

    expect(result).toEqual({
      provider: "stripe",
      autoRenewEnabled: true,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "active",
    });
    expect(setStripeAutoRenew).toHaveBeenCalledWith({
      userId: "user-1",
      enabled: true,
      stripeSubscriptionId: "sub_123",
    });
    expect(setAbacatePayAutoRenew).not.toHaveBeenCalled();
  });
});
