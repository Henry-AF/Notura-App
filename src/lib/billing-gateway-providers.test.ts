import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrCreateBillingAccount = vi.fn();
const resetSubscriptionPeriod = vi.fn();
const setAbacatePayAutoRenew = vi.fn();
const getStripe = vi.fn();
const getStripePriceId = vi.fn();
const retrieveStripeSubscriptionBillingPeriod = vi.fn();
const getAppBaseUrl = vi.fn();
const isPaidCheckoutSession = vi.fn();
const createServiceRoleClient = vi.fn();
const loadAbacatePayCustomerContext = vi.fn();
const ensureAbacatePayCustomer = vi.fn();
const createAbacatePaySubscriptionCheckout = vi.fn();
const cancelAbacatePaySubscription = vi.fn();
const getAbacatePaySubscriptionById = vi.fn();
const getAbacatePayCheckoutExternalId = vi.fn();
const getAbacatePayProductId = vi.fn();
const isAbacatePaySubscriptionPaid = vi.fn();
const withBillingSpan = vi.fn((_options, callback) =>
  callback({ setAttribute: vi.fn() })
);

vi.mock("@/lib/billing", () => ({
  getOrCreateBillingAccount,
  resetSubscriptionPeriod,
  setAbacatePayAutoRenew,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe,
  getStripePriceId,
  retrieveStripeSubscriptionBillingPeriod,
  getAppBaseUrl,
  isPaidCheckoutSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/abacatepay-customer", () => ({
  AbacatePayCustomerNotReadyError: class AbacatePayCustomerNotReadyError extends Error {
    constructor() {
      super("Estamos preparando seu checkout. Tente novamente em alguns segundos.");
    }
  },
  loadAbacatePayCustomerContext,
  ensureAbacatePayCustomer,
}));

vi.mock("@/lib/abacatepay", () => ({
  createAbacatePaySubscriptionCheckout,
  cancelAbacatePaySubscription,
  getAbacatePaySubscriptionById,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductId,
  isAbacatePaySubscriptionPaid,
}));

vi.mock("@/lib/billing-observability", () => ({
  withBillingSpan,
}));

function createAdminClient() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { name: "Ana" },
    error: null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const from = vi.fn().mockReturnValue({ select, update });

  return { from, update, updateEq };
}

describe("billing gateway providers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getOrCreateBillingAccount.mockResolvedValue({
      plan: "free",
      stripe_customer_id: null,
      stripe_pending_checkout_session_id: "cs_123",
      billing_cycle: null,
      abacatepay_pending_checkout_id: null,
      abacatepay_customer_id: "customer-1",
    });
    getStripePriceId.mockReturnValue("price_pro");
    retrieveStripeSubscriptionBillingPeriod.mockResolvedValue({
      billingCycle: "yearly",
      currentPeriodStart: "2026-04-27T12:00:00.000Z",
      currentPeriodEnd: "2027-04-27T12:00:00.000Z",
    });
    getAppBaseUrl.mockImplementation((origin: string) => origin);
    isPaidCheckoutSession.mockReturnValue(true);
    resetSubscriptionPeriod.mockResolvedValue(undefined);
    createServiceRoleClient.mockReturnValue(createAdminClient());
    getStripe.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: "cs_pending",
            url: "https://checkout.stripe.com/session",
          }),
          expire: vi.fn().mockResolvedValue({}),
          retrieve: vi.fn().mockResolvedValue({
            id: "cs_123",
            mode: "subscription",
            payment_status: "paid",
            client_reference_id: "user-1",
            customer: "cus_123",
            subscription: "sub_123",
            metadata: {
              user_id: "user-1",
              plan: "pro",
              provider: "stripe",
            },
          }),
        },
      },
      customers: {
        create: vi.fn().mockResolvedValue({ id: "cus_123" }),
      },
      subscriptions: {
        update: vi.fn().mockResolvedValue({
          cancel_at_period_end: false,
          current_period_end: 1_779_900_000,
          status: "active",
        }),
      },
    });
    loadAbacatePayCustomerContext.mockResolvedValue({
      billingAccount: {
        plan: "free",
        abacatepay_customer_id: "customer-1",
      },
      profile: null,
    });
    ensureAbacatePayCustomer.mockResolvedValue({
      status: "ready",
      customerId: "customer-1",
    });
    getAbacatePayProductId.mockReturnValue("product-pro");
    getAbacatePayCheckoutExternalId.mockReturnValue("onboarding:user-1:pro:nonce");
    createAbacatePaySubscriptionCheckout.mockResolvedValue({
      id: "checkout-1",
      url: "https://pay.abacatepay.com/session",
    });
    cancelAbacatePaySubscription.mockResolvedValue(undefined);
    getAbacatePaySubscriptionById.mockResolvedValue(null);
    isAbacatePaySubscriptionPaid.mockReturnValue(false);
    setAbacatePayAutoRenew.mockResolvedValue({
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-06-14T12:00:00.000Z",
      renewalStatus: "active",
    });
  });

  it("creates Stripe subscription checkout with provider-aware return URLs", async () => {
    const { createStripeCheckout } = await import("./billing-gateway-providers");

    const result = await createStripeCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "pro",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "yearly",
    });

    const stripe = getStripe.mock.results[0]?.value;
    expect(result).toEqual({
      provider: "stripe",
      checkoutUrl: "https://checkout.stripe.com/session",
    });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "ana@example.com",
        line_items: [{ price: "price_pro", quantity: 1 }],
        success_url:
          "http://localhost/dashboard?payment=success&plan=pro&provider=stripe&session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          "http://localhost/dashboard?payment=canceled&plan=pro&provider=stripe",
        metadata: expect.objectContaining({
          provider: "stripe",
          source: "settings",
          user_id: "user-1",
        }),
      })
    );
    expect(getStripePriceId).toHaveBeenCalledWith("pro", "yearly");
  });

  it("stores pending Stripe checkout state for stale-session cleanup", async () => {
    const { createStripeCheckout } = await import("./billing-gateway-providers");

    await createStripeCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "pro",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "monthly",
    });

    const admin = createServiceRoleClient.mock.results[0]?.value;
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_pending_checkout_session_id: "cs_pending",
        stripe_pending_plan: "pro",
      })
    );
  });

  it("expires previous Stripe checkout and cancels fallback checkout before using Stripe", async () => {
    getOrCreateBillingAccount.mockResolvedValueOnce({
      plan: "free",
      stripe_customer_id: null,
      stripe_pending_checkout_session_id: "cs_old",
      abacatepay_pending_checkout_id: "abacatepay-pending-1",
      abacatepay_customer_id: "customer-1",
    });
    const { createStripeCheckout } = await import("./billing-gateway-providers");

    await createStripeCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "pro",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "monthly",
    });

    const stripe = getStripe.mock.results[0]?.value;
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_old");
    expect(cancelAbacatePaySubscription).toHaveBeenCalledWith("abacatepay-pending-1");
  });

  it("stops checkout creation when the pending Stripe checkout was already paid", async () => {
    const completedSessionError = Object.assign(
      new Error(
        'Only Checkout Sessions with a status in ["open"] can be expired. This Checkout Session has a status of `complete`.'
      ),
      { type: "StripeInvalidRequestError" }
    );
    getOrCreateBillingAccount.mockResolvedValueOnce({
      plan: "free",
      stripe_customer_id: null,
      stripe_pending_checkout_session_id: "cs_paid",
      abacatepay_pending_checkout_id: null,
      abacatepay_customer_id: "customer-1",
    });
    const stripe = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: "cs_new",
            url: "https://checkout.stripe.com/session",
          }),
          expire: vi.fn().mockRejectedValue(completedSessionError),
          retrieve: vi.fn(),
        },
      },
    };
    getStripe.mockReturnValueOnce(stripe);
    const { createStripeCheckout } = await import("./billing-gateway-providers");

    await expect(
      createStripeCheckout({
        userId: "user-1",
        userEmail: "ana@example.com",
        plan: "pro",
        source: "settings",
        requestOrigin: "http://localhost",
        billingCycle: "monthly",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "payment_received_plan_pending",
    });

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("keeps fallback pending checkout when its cancellation fails before using Stripe", async () => {
    cancelAbacatePaySubscription.mockRejectedValueOnce(new Error("cancel failed"));
    getOrCreateBillingAccount.mockResolvedValueOnce({
      plan: "free",
      stripe_customer_id: null,
      stripe_pending_checkout_session_id: null,
      abacatepay_pending_checkout_id: "abacatepay-pending-1",
      abacatepay_pending_plan: "pro",
      abacatepay_customer_id: "customer-1",
    });
    const { createStripeCheckout } = await import("./billing-gateway-providers");

    await createStripeCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "pro",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "monthly",
    });

    const admin = createServiceRoleClient.mock.results[0]?.value;
    const payload = admin.update.mock.calls[0]?.[0];
    expect(cancelAbacatePaySubscription).toHaveBeenCalledWith("abacatepay-pending-1");
    expect(payload).not.toHaveProperty("abacatepay_pending_checkout_id");
    expect(payload).not.toHaveProperty("abacatepay_pending_plan");
  });

  it("prewarms and stores a Stripe customer", async () => {
    const { ensureStripeCustomer } = await import("./billing-gateway-providers");

    const result = await ensureStripeCustomer({
      userId: "user-1",
      userEmail: "ana@example.com",
      source: "onboarding",
    });

    const stripe = getStripe.mock.results[0]?.value;
    const admin = createServiceRoleClient.mock.results[0]?.value;
    expect(result).toEqual({
      provider: "stripe",
      status: "ready",
      customerId: "cus_123",
    });
    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@example.com",
        metadata: {
          origin: "onboarding",
          userId: "user-1",
        },
      })
    );
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: "cus_123",
      })
    );
  });

  it("maps Stripe auto-renew to subscription cancel_at_period_end", async () => {
    const { setStripeAutoRenew } = await import("./billing-gateway-providers");

    const result = await setStripeAutoRenew({
      userId: "user-1",
      enabled: false,
      stripeSubscriptionId: "sub_123",
    });

    const stripe = getStripe.mock.results[0]?.value;
    const admin = createServiceRoleClient.mock.results[0]?.value;
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: true,
    });
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_auto_renew_enabled: false,
        stripe_renewal_status: "active",
      })
    );
    expect(result).toEqual({
      provider: "stripe",
      autoRenewEnabled: false,
      currentPeriodEnd: new Date(1_779_900_000 * 1000).toISOString(),
      renewalStatus: "active",
    });
  });

  it("verifies paid Stripe checkout and activates the local subscription", async () => {
    const { verifyStripeCheckout } = await import("./billing-gateway-providers");

    const result = await verifyStripeCheckout({
      userId: "user-1",
      sessionId: "cs_123",
    });

    const stripe = getStripe.mock.results[0]?.value;
    const admin = createServiceRoleClient.mock.results[0]?.value;
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_123");
    expect(retrieveStripeSubscriptionBillingPeriod).toHaveBeenCalledWith("sub_123");
    expect(resetSubscriptionPeriod).toHaveBeenCalledWith(
      {
        userId: "user-1",
        plan: "pro",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        billingCycle: "yearly",
        currentPeriodStart: "2026-04-27T12:00:00.000Z",
        currentPeriodEnd: "2027-04-27T12:00:00.000Z",
      },
      admin
    );
    expect(result).toEqual({
      provider: "stripe",
      success: true,
      plan: "pro",
      paymentStatus: "paid",
    });
  });

  it("accepts Stripe verification after the webhook already activated the session", async () => {
    getOrCreateBillingAccount.mockResolvedValueOnce({
      plan: "pro",
      active_billing_provider: "stripe",
      stripe_subscription_id: "sub_123",
      stripe_pending_checkout_session_id: null,
    });
    const { verifyStripeCheckout } = await import("./billing-gateway-providers");

    const result = await verifyStripeCheckout({
      userId: "user-1",
      sessionId: "cs_123",
    });

    expect(resetSubscriptionPeriod).not.toHaveBeenCalled();
    expect(retrieveStripeSubscriptionBillingPeriod).not.toHaveBeenCalled();
    expect(result).toEqual({
      provider: "stripe",
      success: true,
      plan: "pro",
      paymentStatus: "paid",
    });
  });

  it("does not report AbacatePay success for active Stripe accounts", async () => {
    getOrCreateBillingAccount.mockResolvedValueOnce({
      plan: "pro",
      active_billing_provider: "stripe",
      abacatepay_pending_checkout_id: null,
    });
    const { verifyAbacatePayCheckout } = await import("./billing-gateway-providers");

    await expect(
      verifyAbacatePayCheckout({
        userId: "user-1",
      })
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("reuses an existing AbacatePay fallback checkout while Stripe is unavailable", async () => {
    loadAbacatePayCustomerContext.mockResolvedValueOnce({
      billingAccount: {
        plan: "free",
        abacatepay_customer_id: "customer-1",
        abacatepay_pending_checkout_id: "checkout-existing",
        abacatepay_pending_plan: "team",
        stripe_pending_checkout_session_id: null,
      },
      profile: null,
    });
    getAbacatePaySubscriptionById.mockResolvedValueOnce({
      id: "checkout-existing",
      url: "https://pay.abacatepay.com/existing",
      status: "PENDING",
    });
    const { createAbacatePayCheckout } = await import("./billing-gateway-providers");

    const result = await createAbacatePayCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "team",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "monthly",
    });

    expect(result).toEqual({
      provider: "abacatepay",
      checkoutUrl: "https://pay.abacatepay.com/existing",
    });
    expect(createAbacatePaySubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("keeps Stripe pending checkout when expiration fails before using AbacatePay", async () => {
    const stripe = {
      checkout: {
        sessions: {
          expire: vi.fn().mockRejectedValueOnce(new Error("expire failed")),
        },
      },
    };
    getStripe.mockReturnValueOnce(stripe);
    loadAbacatePayCustomerContext.mockResolvedValueOnce({
      billingAccount: {
        plan: "free",
        abacatepay_customer_id: "customer-1",
        abacatepay_pending_checkout_id: null,
        stripe_pending_checkout_session_id: "cs_pending",
        stripe_pending_plan: "pro",
      },
      profile: null,
    });
    const { createAbacatePayCheckout } = await import("./billing-gateway-providers");

    await createAbacatePayCheckout({
      userId: "user-1",
      userEmail: "ana@example.com",
      plan: "team",
      source: "settings",
      requestOrigin: "http://localhost",
      billingCycle: "monthly",
    });

    const admin = createServiceRoleClient.mock.results[0]?.value;
    const payload = admin.update.mock.calls[0]?.[0];
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_pending");
    expect(payload).not.toHaveProperty("stripe_pending_checkout_session_id");
    expect(payload).not.toHaveProperty("stripe_pending_plan");
  });
});
