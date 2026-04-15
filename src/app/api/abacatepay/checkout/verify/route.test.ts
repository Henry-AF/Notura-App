import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const getOrCreateBillingAccount = vi.fn();
const getAbacatePaySubscriptionById = vi.fn();
const isAbacatePaySubscriptionPaid = vi.fn();
const isAbacatePayTimeoutError = vi.fn();
const parseAbacatePayOnboardingExternalId = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/billing", () => ({
  getOrCreateBillingAccount,
}));

vi.mock("@/lib/abacatepay", () => ({
  getAbacatePaySubscriptionById,
  isAbacatePaySubscriptionPaid,
  isAbacatePayTimeoutError,
  parseAbacatePayOnboardingExternalId,
}));

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
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

describe("POST /api/abacatepay/checkout/verify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    const adminClient = createAdminClient();
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(adminClient);
    getOrCreateBillingAccount.mockResolvedValue({
      user_id: "user-1",
      plan: "free",
      meetings_this_month: 0,
      stripe_customer_id: null,
      abacatepay_customer_id: "customer-1",
      abacatepay_pending_checkout_id: "checkout-1",
      abacatepay_pending_plan: "pro",
      abacatepay_customer_sync_started_at: null,
      created_at: "2026-04-15T00:00:00.000Z",
      updated_at: "2026-04-15T00:00:00.000Z",
    });
    parseAbacatePayOnboardingExternalId.mockImplementation((externalId: string) => {
      const [origin, userId, plan] = externalId.split(":");
      if (origin !== "onboarding") return null;
      if (!userId) return null;
      if (plan !== "pro" && plan !== "team") return null;
      return { userId, plan };
    });
    isAbacatePaySubscriptionPaid.mockReturnValue(true);
    isAbacatePayTimeoutError.mockReturnValue(false);
  });

  it("accepts checkout ownership when externalId has provider suffix", async () => {
    getAbacatePaySubscriptionById.mockResolvedValue({
      id: "checkout-1",
      status: "paid",
      customerId: "customer-1",
      externalId: "onboarding:user-1:pro:retry-1",
      metadata: { userId: "user-1" },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/checkout/verify", {
        method: "POST",
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      plan: "pro",
    });
  });

  it("accepts checkout ownership when user id is sent as metadata.user_id", async () => {
    getAbacatePaySubscriptionById.mockResolvedValue({
      id: "checkout-1",
      status: "paid",
      customerId: "customer-1",
      externalId: "onboarding:user-1:pro",
      metadata: { user_id: "user-1" },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/checkout/verify", {
        method: "POST",
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      plan: "pro",
    });
  });

  it("rejects checkout ownership when externalId belongs to another user", async () => {
    getAbacatePaySubscriptionById.mockResolvedValue({
      id: "checkout-1",
      status: "paid",
      customerId: "customer-1",
      externalId: "onboarding:user-2:pro",
      metadata: { userId: "user-2" },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/checkout/verify", {
        method: "POST",
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Checkout nao pertence ao usuario autenticado.",
    });
  });
});
