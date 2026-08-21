import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  captureObservedError: vi.fn(),
  logStructured: vi.fn(),
  loadUserIdByStripeCustomerId: vi.fn(),
  isTrialConversionInvoice: vi.fn(),
  readInvoiceSubscriptionId: vi.fn(),
  recordReferralConversion: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: mocks.send },
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  logStructured: mocks.logStructured,
}));

vi.mock("@/lib/billing", () => ({
  loadUserIdByStripeCustomerId: mocks.loadUserIdByStripeCustomerId,
}));

vi.mock("@/lib/billing/trial-conversion", () => ({
  isTrialConversionInvoice: mocks.isTrialConversionInvoice,
}));

vi.mock("@/lib/stripe", () => ({
  readInvoiceSubscriptionId: mocks.readInvoiceSubscriptionId,
}));

vi.mock("@/lib/referrals", () => ({
  recordReferralConversion: mocks.recordReferralConversion,
}));

describe("trial-email-events dispatchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue(undefined);
  });

  it("dispatches trial_started with the exact id/name/data", async () => {
    const { dispatchTrialStartedEmailEvent } = await import("./trial-email-events");

    await dispatchTrialStartedEmailEvent({
      userId: "user-1",
      stripeSubscriptionId: "sub-1",
      trialStartAt: "2026-08-06T00:00:00.000Z",
      trialEndAt: "2026-08-13T00:00:00.000Z",
    });

    expect(mocks.send).toHaveBeenCalledWith({
      id: "resend-event:trial_started:sub-1",
      name: "email/resend.trial-event",
      data: {
        resendEvent: "notura.trial_started",
        userId: "user-1",
        claimColumn: "trial_started_email_event_at",
        payload: {
          user_id: "user-1",
          trial_start_at: "2026-08-06T00:00:00.000Z",
          trial_end_at: "2026-08-13T00:00:00.000Z",
        },
      },
    });
  });

  it("dispatches trial_converted with the exact id/name/data", async () => {
    const { dispatchTrialConvertedEmailEvent } = await import("./trial-email-events");

    await dispatchTrialConvertedEmailEvent({
      userId: "user-1",
      stripeSubscriptionId: "sub-1",
      convertedAt: "2026-08-13T00:00:00.000Z",
    });

    expect(mocks.send).toHaveBeenCalledWith({
      id: "resend-event:trial_converted:sub-1",
      name: "email/resend.trial-event",
      data: {
        resendEvent: "notura.trial_converted",
        userId: "user-1",
        claimColumn: "trial_converted_email_event_at",
        payload: {
          user_id: "user-1",
          converted_at: "2026-08-13T00:00:00.000Z",
        },
      },
    });
  });
});

describe("trial-email-events dispatchers — dedupe and failure isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue(undefined);
  });

  it("uses the same dedupe id whether called from the webhook path or the verify path", async () => {
    const { dispatchTrialStartedEmailEvent } = await import("./trial-email-events");

    await dispatchTrialStartedEmailEvent({
      userId: "user-1",
      stripeSubscriptionId: "sub-1",
      trialStartAt: "2026-08-06T00:00:00.000Z",
      trialEndAt: "2026-08-13T00:00:00.000Z",
    });
    await dispatchTrialStartedEmailEvent({
      userId: "user-1",
      stripeSubscriptionId: "sub-1",
      trialStartAt: "2026-08-06T00:00:00.000Z",
      trialEndAt: "2026-08-13T00:00:00.000Z",
    });

    const ids = mocks.send.mock.calls.map((call) => (call[0] as { id: string }).id);
    expect(ids).toEqual(["resend-event:trial_started:sub-1", "resend-event:trial_started:sub-1"]);
  });

  it("resolves instead of throwing when inngest.send rejects, and captures the error", async () => {
    mocks.send.mockRejectedValueOnce(new Error("inngest unavailable"));
    const { dispatchTrialStartedEmailEvent } = await import("./trial-email-events");

    await expect(
      dispatchTrialStartedEmailEvent({
        userId: "user-1",
        stripeSubscriptionId: "sub-1",
        trialStartAt: "2026-08-06T00:00:00.000Z",
        trialEndAt: "2026-08-13T00:00:00.000Z",
      })
    ).resolves.toBeUndefined();

    expect(mocks.captureObservedError).toHaveBeenCalled();
  });
});

describe("maybeDispatchTrialConvertedEmailEvent", () => {
  const stripe = { subscriptions: { retrieve: vi.fn() } };
  const supabase = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue(undefined);
    mocks.recordReferralConversion.mockResolvedValue(undefined);
    stripe.subscriptions.retrieve.mockReset();
  });

  it("does not call send nor subscriptions.retrieve when billing_reason is wrong", async () => {
    const { maybeDispatchTrialConvertedEmailEvent } = await import("./trial-email-events");

    await maybeDispatchTrialConvertedEmailEvent({
      stripe: stripe as never,
      supabase,
      invoice: { billing_reason: "subscription_update" } as never,
      customerId: "cus-1",
      requestId: "req-1",
    });

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("resolves without throwing when subscriptions.retrieve rejects", async () => {
    mocks.readInvoiceSubscriptionId.mockReturnValue("sub-1");
    stripe.subscriptions.retrieve.mockRejectedValueOnce(new Error("stripe down"));
    const { maybeDispatchTrialConvertedEmailEvent } = await import("./trial-email-events");

    await expect(
      maybeDispatchTrialConvertedEmailEvent({
        stripe: stripe as never,
        supabase,
        invoice: { billing_reason: "subscription_cycle" } as never,
        customerId: "cus-1",
        requestId: "req-1",
      })
    ).resolves.toBeUndefined();

    expect(mocks.captureObservedError).toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send when loadUserIdByStripeCustomerId resolves null", async () => {
    mocks.readInvoiceSubscriptionId.mockReturnValue("sub-1");
    stripe.subscriptions.retrieve.mockResolvedValueOnce({ id: "sub-1" });
    mocks.isTrialConversionInvoice.mockReturnValue(true);
    mocks.loadUserIdByStripeCustomerId.mockResolvedValueOnce(null);
    const { maybeDispatchTrialConvertedEmailEvent } = await import("./trial-email-events");

    await maybeDispatchTrialConvertedEmailEvent({
      stripe: stripe as never,
      supabase,
      invoice: { billing_reason: "subscription_cycle" } as never,
      customerId: "cus-1",
      requestId: "req-1",
    });

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.recordReferralConversion).not.toHaveBeenCalled();
  });

});

describe("maybeDispatchTrialConvertedEmailEvent — referral conversion", () => {
  const stripe = { subscriptions: { retrieve: vi.fn() } };
  const supabase = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue(undefined);
    mocks.recordReferralConversion.mockResolvedValue(undefined);
    mocks.readInvoiceSubscriptionId.mockReturnValue("sub-1");
    mocks.isTrialConversionInvoice.mockReturnValue(true);
    mocks.loadUserIdByStripeCustomerId.mockResolvedValueOnce("user-1");
    stripe.subscriptions.retrieve.mockReset();
    stripe.subscriptions.retrieve.mockResolvedValueOnce({ id: "sub-1" });
  });

  it("records the referral conversion when the invoice is a valid conversion", async () => {
    const { maybeDispatchTrialConvertedEmailEvent } = await import("./trial-email-events");

    await maybeDispatchTrialConvertedEmailEvent({
      stripe: stripe as never,
      supabase,
      invoice: { billing_reason: "subscription_cycle" } as never,
      customerId: "cus-1",
      requestId: "req-1",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resend-event:trial_converted:sub-1" })
    );
    expect(mocks.recordReferralConversion).toHaveBeenCalledWith("user-1", supabase);
  });

  it("still dispatches the trial_converted email when recordReferralConversion rejects", async () => {
    mocks.recordReferralConversion.mockRejectedValueOnce(new Error("db down"));
    const { maybeDispatchTrialConvertedEmailEvent } = await import("./trial-email-events");

    await expect(
      maybeDispatchTrialConvertedEmailEvent({
        stripe: stripe as never,
        supabase,
        invoice: { billing_reason: "subscription_cycle" } as never,
        customerId: "cus-1",
        requestId: "req-1",
      })
    ).resolves.toBeUndefined();

    // A referral-recording failure is its own isolated failure domain — it
    // must never block the trial_converted email, the same way a Resend
    // failure must never block the NOT-94 billing/quota-reset path.
    expect(mocks.captureObservedError).toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resend-event:trial_converted:sub-1" })
    );
  });
});
