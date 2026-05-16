import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createOptionalServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const createOptionalServiceRoleClient = vi.fn();
const createAbacatePaySubscriptionCheckout = vi.fn();
const getAbacatePayCheckoutExternalId = vi.fn();
const getAbacatePayProductIdForCheckout = vi.fn();
const isAbacatePayTimeoutError = vi.fn();
const ensureAbacatePayCustomer = vi.fn();
const loadAbacatePayCustomerContext = vi.fn();
const withBillingSpan = vi.fn((_options, callback) => {
  return callback({ setAttribute: vi.fn() });
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createOptionalServerSupabase,
  createServiceRoleClient,
  createOptionalServiceRoleClient,
}));

vi.mock("@/lib/abacatepay", () => ({
  createAbacatePaySubscriptionCheckout,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductIdForCheckout,
  isAbacatePayTimeoutError,
}));

vi.mock("@/lib/abacatepay-customer", () => ({
  AbacatePayCustomerNotReadyError: class AbacatePayCustomerNotReadyError extends Error {
    constructor() {
      super("Estamos preparando seu checkout. Tente novamente em alguns segundos.");
    }
  },
  ensureAbacatePayCustomer,
  loadAbacatePayCustomerContext,
}));

vi.mock("@/lib/billing-observability", () => ({
  withBillingSpan,
}));

function createServerClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            email: "ana@example.com",
          },
        },
        error: null,
      }),
    },
  };
}

function createAdminClient() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ update });

  return {
    from,
    update,
    updateEq,
  };
}

describe("POST /api/abacatepay/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient());
    createOptionalServerSupabase.mockReturnValue(createServerClient());
    createServiceRoleClient.mockReturnValue(createAdminClient());
    createOptionalServiceRoleClient.mockReturnValue(createAdminClient());
    loadAbacatePayCustomerContext.mockResolvedValue({
      billingAccount: {
        plan: "free",
        abacatepay_customer_id: "customer-1",
      },
    });
    ensureAbacatePayCustomer.mockResolvedValue({
      customerId: "customer-1",
    });
    getAbacatePayProductIdForCheckout.mockReturnValue("product-team");
    getAbacatePayCheckoutExternalId.mockReturnValue(
      "onboarding:user-1:team:nonce-1"
    );
    createAbacatePaySubscriptionCheckout.mockResolvedValue({
      id: "checkout-1",
      url: "https://checkout.example.com/session",
    });
    isAbacatePayTimeoutError.mockReturnValue(false);
  });

  it("returns dashboard settings URLs for dashboard plan changes", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          price: 69,
          source: "settings",
        }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checkoutUrl: "https://checkout.example.com/session",
    });
    expect(createAbacatePaySubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl:
          "http://localhost/dashboard/settings?payment=canceled&plan=pro&billingCycle=yearly&provider=abacatepay",
        completionUrl:
          "http://localhost/dashboard/settings?payment=success&plan=pro&billingCycle=yearly&provider=abacatepay",
        metadata: expect.objectContaining({
          origin: "settings",
          plan: "pro",
          internalPlan: "team",
          billingCycle: "yearly",
          price: 69,
          userId: "user-1",
        }),
      })
    );
    expect(withBillingSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing.abacatepay.create_subscription_checkout",
        op: "http.client",
        attributes: expect.objectContaining({
          "billing.dependency": "abacatepay",
          "billing.flow": "settings",
          hadCustomerIdAtStart: true,
          waitedForFreshLock: false,
        }),
      }),
      expect.any(Function)
    );
    expect(withBillingSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing.abacatepay.update_billing_accounts",
        op: "db",
        attributes: expect.objectContaining({
          "billing.flow": "settings",
          hadCustomerIdAtStart: true,
          waitedForFreshLock: false,
        }),
      }),
      expect.any(Function)
    );
  });

  it("uses an existing AbacatePay customer without ensuring during checkout", async () => {
    loadAbacatePayCustomerContext.mockResolvedValueOnce({
      billingAccount: {
        plan: "free",
        abacatepay_customer_id: "customer-ready",
      },
    });
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          price: 69,
          source: "settings",
        }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(ensureAbacatePayCustomer).not.toHaveBeenCalled();
    expect(createAbacatePaySubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-ready",
      })
    );
  });

  it("fails fast without starting checkout when no AbacatePay customer exists", async () => {
    loadAbacatePayCustomerContext.mockResolvedValueOnce({
      billingAccount: {
        plan: "free",
        abacatepay_customer_id: null,
      },
    });
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "yearly",
          price: 69,
          source: "settings",
        }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Estamos preparando seu checkout. Tente novamente em alguns segundos.",
    });
    expect(ensureAbacatePayCustomer).not.toHaveBeenCalled();
    expect(createAbacatePaySubscriptionCheckout).not.toHaveBeenCalled();
  });
});
