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

const activeEntitlement = {
  plan: "pro",
  effectivePlan: "pro",
  status: "active",
  isPaidActive: true,
  isExpired: false,
  isInGrace: false,
};

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
    entitlement: activeEntitlement,
  });
});

describe("current user renewal state", () => {
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
});

describe("current user entitlements", () => {
  it("exposes WhatsApp summary access as false for free users", async () => {
    getBillingStatus.mockResolvedValueOnce({
      billingAccount: {
        plan: "free",
        current_period_end: null,
      },
      meetingsThisMonth: 1,
      monthlyLimit: 3,
      entitlement: {
        plan: "free",
        effectivePlan: "free",
        status: "free",
        isPaidActive: false,
        isExpired: false,
        isInGrace: false,
      },
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
});

describe("current user billing provider selection", () => {
  it("prefers Stripe renewal state when the active subscription is on Stripe", async () => {
    getBillingStatus.mockResolvedValueOnce({
      billingAccount: {
        plan: "pro",
        active_billing_provider: "stripe",
        current_period_end: "2026-05-27T12:00:00.000Z",
        stripe_subscription_id: "sub_123",
        stripe_auto_renew_enabled: false,
        stripe_renewal_status: "canceling",
        abacatepay_auto_renew_enabled: true,
        abacatepay_renewal_status: "active",
      },
      meetingsThisMonth: 12,
      monthlyLimit: 30,
      entitlement: activeEntitlement,
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

  it("uses AbacatePay renewal state when it is the active fallback provider", async () => {
    getBillingStatus.mockResolvedValueOnce({
      billingAccount: {
        plan: "pro",
        active_billing_provider: "abacatepay",
        current_period_end: "2026-05-27T12:00:00.000Z",
        stripe_subscription_id: "sub_123",
        stripe_auto_renew_enabled: false,
        stripe_renewal_status: "canceling",
        abacatepay_auto_renew_enabled: true,
        abacatepay_renewal_status: "active",
      },
      meetingsThisMonth: 12,
      monthlyLimit: 30,
      entitlement: activeEntitlement,
    });
    const mod = await import("./current-user");

    const user = await mod.getCurrentUserForIdentity({
      id: "user-1",
      email: "ana@example.com",
    });

    expect(user).toMatchObject({
      billingProvider: "abacatepay",
      autoRenewEnabled: true,
      renewalStatus: "active",
      abacatepayAutoRenewEnabled: true,
      abacatepayRenewalStatus: "active",
    });
  });
});

describe("current user expired entitlement", () => {
  it("does not expose paid feature access for an expired paid billing account", async () => {
    getBillingStatus.mockResolvedValueOnce({
      billingAccount: {
        plan: "team",
        active_billing_provider: "abacatepay",
        current_period_end: "2026-05-29T12:00:00.000Z",
        abacatepay_auto_renew_enabled: true,
        abacatepay_renewal_status: "active",
      },
      meetingsThisMonth: 12,
      monthlyLimit: 3,
      entitlement: {
        plan: "team",
        effectivePlan: "free",
        status: "expired",
        isPaidActive: false,
        isExpired: true,
        isInGrace: false,
      },
    });
    const mod = await import("./current-user");

    const user = await mod.getCurrentUserForIdentity({
      id: "user-1",
      email: "ana@example.com",
    });

    expect(user).toMatchObject({
      plan: "free",
      effectivePlan: "free",
      billingEntitlementStatus: "expired",
      isPaidPlanActive: false,
      canSendWhatsAppSummary: false,
      monthlyLimit: 3,
    });
  });
});
