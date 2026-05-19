import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();
const getBillingStatus = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
  createServiceRoleClient,
}));

vi.mock("@/lib/billing", () => ({
  getBillingStatus,
}));

function createProfileClient() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      name: "Ana",
      company: "Acme",
      whatsapp_number: "+55 (11) 99999-9999",
    },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from };
}

describe("current user server mapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServiceRoleClient.mockReturnValue(createProfileClient());
    getBillingStatus.mockResolvedValue({
      billingAccount: {
        plan: "pro",
        current_period_end: "2026-05-27T12:00:00.000Z",
        abacatepay_auto_renew_enabled: false,
        abacatepay_renewal_status: "active",
      },
      meetingsThisMonth: 12,
      monthlyLimit: 30,
    });
  });

  it("exposes AbacatePay renewal state to settings clients", async () => {
    const mod = await import("./current-user");

    const user = await mod.getCurrentUserForIdentity({
      id: "user-1",
      email: "ana@example.com",
    });

    expect(user).toMatchObject({
      id: "user-1",
      plan: "pro",
      canSendWhatsAppSummary: true,
      currentPeriodEnd: "2026-05-27T12:00:00.000Z",
      abacatepayAutoRenewEnabled: false,
      abacatepayRenewalStatus: "active",
    });
  });

  it("exposes WhatsApp summary access as false for free users", async () => {
    getBillingStatus.mockResolvedValueOnce({
      billingAccount: {
        plan: "free",
        current_period_end: null,
      },
      meetingsThisMonth: 1,
      monthlyLimit: 3,
    });
    const mod = await import("./current-user");

    const user = await mod.getCurrentUserForIdentity({
      id: "user-1",
      email: "ana@example.com",
    });

    expect(user).toMatchObject({
      plan: "free",
      canSendWhatsAppSummary: false,
    });
  });

  it("prefers Stripe renewal state when the active subscription is on Stripe", async () => {
    getBillingStatus.mockResolvedValueOnce({
      billingAccount: {
        plan: "pro",
        current_period_end: "2026-05-27T12:00:00.000Z",
        stripe_subscription_id: "sub_123",
        stripe_auto_renew_enabled: false,
        stripe_renewal_status: "canceling",
        abacatepay_auto_renew_enabled: true,
        abacatepay_renewal_status: "active",
      },
      meetingsThisMonth: 12,
      monthlyLimit: 30,
    });
    const mod = await import("./current-user");

    const user = await mod.getCurrentUserForIdentity({
      id: "user-1",
      email: "ana@example.com",
    });

    expect(user).toMatchObject({
      billingProvider: "stripe",
      autoRenewEnabled: false,
      renewalStatus: "canceling",
      abacatepayAutoRenewEnabled: false,
      abacatepayRenewalStatus: "canceling",
    });
  });
});
