import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const createAbacatePaySubscriptionCheckout = vi.fn();
const getAbacatePayCheckoutExternalId = vi.fn();
const getAbacatePayProductId = vi.fn();
const isAbacatePayTimeoutError = vi.fn();
const ensureAbacatePayCustomer = vi.fn();
const loadAbacatePayCustomerContext = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/abacatepay", () => ({
  createAbacatePaySubscriptionCheckout,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductId,
  isAbacatePayTimeoutError,
}));

vi.mock("@/lib/abacatepay-customer", () => ({
  AbacatePayCustomerNotReadyError: class AbacatePayCustomerNotReadyError extends Error {},
  ensureAbacatePayCustomer,
  loadAbacatePayCustomerContext,
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
    createServiceRoleClient.mockReturnValue(createAdminClient());
    loadAbacatePayCustomerContext.mockResolvedValue({
      billingAccount: {
        plan: "pro",
      },
    });
    ensureAbacatePayCustomer.mockResolvedValue({
      customerId: "customer-1",
    });
    getAbacatePayProductId.mockReturnValue("product-team");
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
          plan: "team",
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
          "http://localhost/dashboard/settings?payment=canceled&plan=team&provider=abacatepay",
        completionUrl:
          "http://localhost/dashboard/settings?payment=success&plan=team&provider=abacatepay",
        metadata: expect.objectContaining({
          origin: "settings",
          plan: "team",
          userId: "user-1",
        }),
      })
    );
  });
});
