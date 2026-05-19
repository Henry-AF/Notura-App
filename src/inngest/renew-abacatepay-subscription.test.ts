import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureObservedError: vi.fn(),
  createAbacatePaySubscriptionCheckout: vi.fn(),
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getAbacatePayCheckoutExternalId: vi.fn(),
  getAbacatePayProductId: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/abacatepay", () => ({
  createAbacatePaySubscriptionCheckout:
    mocks.createAbacatePaySubscriptionCheckout,
  getAbacatePayCheckoutExternalId: mocks.getAbacatePayCheckoutExternalId,
  getAbacatePayProductId: mocks.getAbacatePayProductId,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

interface BillingRow {
  user_id: string;
  plan: "free" | "pro" | "team";
  current_period_end: string | null;
  abacatepay_customer_id: string | null;
  abacatepay_auto_renew_enabled: boolean;
  abacatepay_renewal_attempts: number;
  abacatepay_renewal_period_end: string | null;
  abacatepay_pending_checkout_id: string | null;
  abacatepay_pending_plan: "free" | "pro" | "team" | null;
}

function createBillingRow(overrides: Partial<BillingRow> = {}): BillingRow {
  return {
    user_id: "user-1",
    plan: "pro",
    current_period_end: "2026-05-27T12:00:00.000Z",
    abacatepay_customer_id: "customer-1",
    abacatepay_auto_renew_enabled: true,
    abacatepay_renewal_attempts: 0,
    abacatepay_renewal_period_end: null,
    abacatepay_pending_checkout_id: null,
    abacatepay_pending_plan: null,
    ...overrides,
  };
}

function createSupabaseMock(row: BillingRow | null) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const selectEq = vi.fn().mockReturnValue({ single, maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ select, update });

  return { from, update, updateEq, maybeSingle };
}

async function runRenewal(input?: { userId?: string; attempt?: number }) {
  const { renewAbacatePaySubscription } = await import(
    "./renew-abacatepay-subscription"
  );
  const step = {
    run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
    sendEvent: vi.fn().mockResolvedValue(undefined),
  };

  const result = await (
    renewAbacatePaySubscription as {
      handler: (input: unknown) => Promise<unknown>;
    }
  ).handler({
    event: {
      id: "event-1",
      name: "billing/abacatepay.renew",
      data: {
        userId: input?.userId ?? "user-1",
        attempt: input?.attempt,
      },
    },
    step,
  });

  return { result, step };
}

describe("renewAbacatePaySubscription", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    process.env.NEXT_PUBLIC_APP_URL = "https://app.notura.com";

    mocks.createFunction.mockImplementation((_config, handler) => ({ handler }));
    mocks.getAbacatePayProductId.mockReturnValue("product-pro");
    mocks.getAbacatePayCheckoutExternalId.mockImplementation(
      (userId: string, plan: string, nonce?: string) =>
        `onboarding:${userId}:${plan}:${nonce}`
    );
    mocks.createAbacatePaySubscriptionCheckout.mockResolvedValue({
      id: "renewal-checkout-1",
      url: "https://abacatepay.test/checkout",
    });
  });

  it("skips renewal when auto-renew is currently disabled in the database", async () => {
    const supabase = createSupabaseMock(
      createBillingRow({ abacatepay_auto_renew_enabled: false })
    );
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    const { result } = await runRenewal({ attempt: 1 });

    expect(result).toEqual({ status: "skipped-auto-renew-disabled" });
    expect(mocks.createAbacatePaySubscriptionCheckout).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("skips renewal when the billing account no longer exists", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });
    const update = vi.fn();
    mocks.createServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select, update }),
    });

    const { result } = await runRenewal({ attempt: 1 });

    expect(result).toEqual({ status: "skipped-no-paid-account" });
    expect(maybeSingle).toHaveBeenCalled();
    expect(mocks.createAbacatePaySubscriptionCheckout).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("creates a new AbacatePay checkout when auto-renew is enabled at runtime", async () => {
    const supabase = createSupabaseMock(createBillingRow());
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    const { result } = await runRenewal({ attempt: 1 });

    expect(result).toEqual({ status: "checkout-created" });
    expect(mocks.createAbacatePaySubscriptionCheckout).toHaveBeenCalledWith({
      productId: "product-pro",
      customerId: "customer-1",
      externalId: "onboarding:user-1:pro:renewal:2026-05-27T12:00:00.000Z",
      returnUrl:
        "https://app.notura.com/dashboard?payment=canceled&plan=pro&provider=abacatepay",
      completionUrl:
        "https://app.notura.com/dashboard?payment=success&plan=pro&provider=abacatepay",
      metadata: {
        userId: "user-1",
        plan: "pro",
        origin: "auto_renewal",
        attempt: 1,
        renewalPeriodEnd: "2026-05-27T12:00:00.000Z",
      },
    });
    expect(mocks.getAbacatePayCheckoutExternalId).toHaveBeenCalledWith(
      "user-1",
      "pro",
      "renewal:2026-05-27T12:00:00.000Z"
    );
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        abacatepay_pending_checkout_id: "renewal-checkout-1",
        abacatepay_pending_plan: "pro",
        abacatepay_renewal_period_end: "2026-05-27T12:00:00.000Z",
        abacatepay_renewal_attempts: 1,
        abacatepay_renewal_status: "checkout_created",
        abacatepay_last_renewal_error: null,
      })
    );
  });

  it("reuses a pending renewal checkout for the same current period", async () => {
    const supabase = createSupabaseMock(
      createBillingRow({
        abacatepay_pending_checkout_id: "existing-checkout-1",
        abacatepay_pending_plan: "pro",
        abacatepay_renewal_period_end: "2026-05-27T12:00:00.000Z",
      })
    );
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    const { result } = await runRenewal({ attempt: 2 });

    expect(result).toEqual({
      status: "checkout-already-pending",
      checkoutId: "existing-checkout-1",
    });
    expect(mocks.createAbacatePaySubscriptionCheckout).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("retries failed renewals after 24h and then 48h", async () => {
    const supabase = createSupabaseMock(createBillingRow());
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.createAbacatePaySubscriptionCheckout.mockRejectedValue(
      new Error("provider down")
    );

    const { result, step } = await runRenewal({ attempt: 1 });

    expect(result).toEqual({ status: "retrying", attempt: 1 });
    expect(step.sendEvent).toHaveBeenCalledWith("schedule-renewal-retry", {
      name: "billing/abacatepay.renew",
      data: { userId: "user-1", attempt: 2 },
      ts: new Date("2026-05-28T12:00:00.000Z").getTime(),
    });
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        abacatepay_renewal_attempts: 1,
        abacatepay_renewal_status: "retrying",
        abacatepay_last_renewal_error: "provider down",
        abacatepay_next_renewal_attempt_at: "2026-05-28T12:00:00.000Z",
      })
    );
  });

  it("suspends renewal after the third failed attempt without retrying again", async () => {
    const supabase = createSupabaseMock(createBillingRow());
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.createAbacatePaySubscriptionCheckout.mockRejectedValue(
      new Error("provider down")
    );

    const { result, step } = await runRenewal({ attempt: 3 });

    expect(result).toEqual({ status: "suspended", attempt: 3 });
    expect(step.sendEvent).not.toHaveBeenCalled();
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        abacatepay_renewal_attempts: 3,
        abacatepay_renewal_status: "suspended",
        abacatepay_last_renewal_error: "provider down",
        abacatepay_next_renewal_attempt_at: null,
      })
    );
  });
});
