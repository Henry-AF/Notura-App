import { beforeEach, describe, expect, it, vi } from "vitest";

const createAbacatePayCustomer = vi.fn();
const getAbacatePayCustomerPhone = vi.fn();
const getOrCreateBillingAccount = vi.fn();
const isAbacatePayTimeoutError = vi.fn();
const withBillingSpan = vi.fn((_options, callback) => {
  return callback({ setAttribute: vi.fn() });
});

vi.mock("@/lib/abacatepay", () => ({
  createAbacatePayCustomer,
  getAbacatePayCustomerPhone,
  isAbacatePayTimeoutError,
}));

vi.mock("@/lib/billing", () => ({
  getOrCreateBillingAccount,
}));

vi.mock("@/lib/billing-observability", () => ({
  withBillingSpan,
  setBillingSpanAttribute: (span: { setAttribute: (key: string, value: boolean) => void }, key: string, value: boolean) => {
    span.setAttribute(key, value);
  },
}));

function createProfileSupabase(profileResult: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from };
}

function createNewCustomerSupabase() {
  const billingChain: Record<string, unknown> = {};
  billingChain.select = vi.fn(() => billingChain);
  billingChain.eq = vi.fn(() => billingChain);
  billingChain.is = vi.fn(() => billingChain);
  billingChain.lt = vi.fn(() => billingChain);
  billingChain.update = vi.fn(() => billingChain);
  billingChain.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        abacatepay_customer_id: null,
        abacatepay_customer_sync_started_at: null,
      },
      error: null,
    })
    .mockResolvedValueOnce({
      data: {
        user_id: "user-1",
      },
      error: null,
    });

  return {
    from: vi.fn().mockReturnValue(billingChain),
    billingChain,
  };
}

describe("AbacatePay customer preparation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isAbacatePayTimeoutError.mockReturnValue(false);
  });

  it("wraps customer context loading in a billing span", async () => {
    getOrCreateBillingAccount.mockResolvedValue({
      user_id: "user-1",
      plan: "free",
      abacatepay_customer_id: "customer-1",
    });
    const supabase = createProfileSupabase({
      data: {
        name: "Ana",
        whatsapp_number: "+5511999999999",
      },
      error: null,
    });

    const mod = await import("./abacatepay-customer");
    await mod.loadAbacatePayCustomerContext(supabase as never, "user-1");

    expect(withBillingSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing.abacatepay.load_customer_context",
        op: "db",
        attributes: expect.objectContaining({
          "billing.operation": "loadAbacatePayCustomerContext",
        }),
      }),
      expect.any(Function)
    );
  });

  it("records ensure customer flags when a customer already exists", async () => {
    const mod = await import("./abacatepay-customer");

    const result = await mod.ensureAbacatePayCustomer(
      {} as never,
      {
        id: "user-1",
        email: "ana@example.com",
      },
      {
        billingAccount: {
          plan: "pro",
          abacatepay_customer_id: "customer-ready",
        } as never,
        profile: null,
      },
      {
        source: "settings",
      }
    );

    expect(result).toEqual({
      status: "ready",
      customerId: "customer-ready",
    });
    expect(withBillingSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing.abacatepay.ensure_customer",
        op: "billing",
        attributes: expect.objectContaining({
          "billing.flow": "settings",
          hadCustomerIdAtStart: true,
          waitedForFreshLock: false,
        }),
      }),
      expect.any(Function)
    );
  });

  it("wraps AbacatePay customer creation in an external dependency span", async () => {
    const { billingChain, from } = createNewCustomerSupabase();
    getAbacatePayCustomerPhone.mockReturnValue("+5511999999999");
    createAbacatePayCustomer.mockResolvedValue({
      id: "customer-new",
    });

    const mod = await import("./abacatepay-customer");
    const result = await mod.ensureAbacatePayCustomer(
      { from } as never,
      {
        id: "user-1",
        email: "ana@example.com",
      },
      {
        billingAccount: {
          plan: "free",
          abacatepay_customer_id: null,
        } as never,
        profile: {
          name: "Ana",
          whatsapp_number: "+5511888888888",
        },
      },
      {
        source: "settings",
      }
    );

    expect(result).toEqual({
      status: "ready",
      customerId: "customer-new",
    });
    expect(createAbacatePayCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          userId: "user-1",
          origin: "settings",
        },
      })
    );
    expect(withBillingSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing.abacatepay.create_customer",
        op: "http.client",
        attributes: expect.objectContaining({
          "billing.dependency": "abacatepay",
          "billing.flow": "settings",
          hadCustomerIdAtStart: false,
          waitedForFreshLock: false,
        }),
      }),
      expect.any(Function)
    );
    expect(billingChain.update).toHaveBeenCalled();
  });
});
