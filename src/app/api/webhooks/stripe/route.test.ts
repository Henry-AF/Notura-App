import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();
const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const inngestSend = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent,
    },
    subscriptions: {
      retrieve: retrieveSubscription,
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: inngestSend },
}));

function createAdminClient(
  billingAccount: Record<string, unknown> | null = {
    stripe_customer_id: null,
    stripe_pending_checkout_session_id: "cs-1",
  }
) {
  const updateQuery = {
    eq: vi.fn(),
    then: vi.fn(),
  };
  updateQuery.eq.mockReturnValue(updateQuery);
  updateQuery.then.mockImplementation((resolve) => resolve({ error: null }));
  const update = vi.fn().mockReturnValue(updateQuery);
  const maybeSingle = vi.fn().mockResolvedValue({
    data: billingAccount,
    error: null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, update, upsert });

  return {
    from,
    update,
    updateEq: updateQuery.eq,
    upsert,
  };
}

describe("POST /api/webhooks/stripe", () => {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    createServiceRoleClient.mockReturnValue(createAdminClient());
    retrieveSubscription.mockResolvedValue({
      id: "sub-1",
      items: {
        data: [
          {
            current_period_start: 1_777_291_200,
            current_period_end: 1_808_827_200,
            price: {
              recurring: {
                interval: "year",
              },
            },
          },
        ],
      },
    });
    inngestSend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalSecretKey;
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("resets quota period on checkout completion", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs-1",
          metadata: { user_id: "user-1", plan: "team" },
          customer: "cus-1",
          subscription: "sub-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "team",
        meetings_used: 0,
        billing_cycle: "yearly",
        current_period_start: "2026-04-27T12:00:00.000Z",
        current_period_end: "2027-04-27T12:00:00.000Z",
        stripe_customer_id: "cus-1",
        stripe_subscription_id: "sub-1",
        stripe_auto_renew_enabled: true,
        stripe_renewal_status: "active",
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("activates a trialing subscription when checkout metadata marks it as a trial", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs-1",
          metadata: { user_id: "user-1", plan: "team", is_trial: "true" },
          customer: "cus-1",
          subscription: "sub-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "team",
        stripe_renewal_status: "trialing",
        has_used_trial: true,
        trial_started_at: expect.any(String),
        trial_end_at: "2027-04-27T12:00:00.000Z",
      })
    );
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "resend-event:trial_started:sub-1",
        name: "email/resend.trial-event",
        data: expect.objectContaining({
          resendEvent: "notura.trial_started",
          userId: "user-1",
          payload: expect.objectContaining({
            user_id: "user-1",
            trial_start_at: "2026-04-27T12:00:00.000Z",
            trial_end_at: "2027-04-27T12:00:00.000Z",
          }),
        }),
      })
    );
  });

  it("does not dispatch a trial_started email event when checkout metadata has no is_trial flag", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs-1",
          metadata: { user_id: "user-1", plan: "team" },
          customer: "cus-1",
          subscription: "sub-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("dispatches nothing for a stale checkout session", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({
        stripe_customer_id: null,
        stripe_pending_checkout_session_id: null,
      })
    );
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs-stale",
          metadata: { user_id: "user-1", plan: "team", is_trial: "true" },
          customer: "cus-1",
          subscription: "sub-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("keeps a 200 response and the billing update when inngest.send rejects on trial start", async () => {
    inngestSend.mockRejectedValueOnce(new Error("inngest unavailable"));
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs-1",
          metadata: { user_id: "user-1", plan: "team", is_trial: "true" },
          customer: "cus-1",
          subscription: "sub-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "team", has_used_trial: true })
    );
  });

  it("ignores stale checkout completions that are no longer pending", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({
        stripe_customer_id: null,
        stripe_pending_checkout_session_id: null,
      })
    );
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs-stale",
          metadata: { user_id: "user-1", plan: "team" },
          customer: "cus-1",
          subscription: "sub-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(retrieveSubscription).not.toHaveBeenCalled();
    expect(adminClient.update).not.toHaveBeenCalled();
  });

  it("syncs Stripe subscription auto-renew status from subscription updates", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub-1",
          customer: "cus-1",
          cancel_at_period_end: true,
          status: "active",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: "sub-1",
        stripe_auto_renew_enabled: false,
        stripe_renewal_status: "canceling",
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("stripe_subscription_id", "sub-1");
  });

  it("keeps the trialing status when auto-renew is cancelled mid-trial", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub-1",
          customer: "cus-1",
          cancel_at_period_end: true,
          status: "trialing",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: "sub-1",
        stripe_auto_renew_enabled: false,
        stripe_renewal_status: "trialing",
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("stripe_subscription_id", "sub-1");
  });

  it("resets quota period on paid subscription renewal invoices", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus-1",
          parent: {
            subscription_details: {
              subscription: "sub-1",
            },
          },
          billing_reason: "subscription_cycle",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        meetings_used: 0,
        billing_cycle: "yearly",
        current_period_start: "2026-04-27T12:00:00.000Z",
        current_period_end: "2027-04-27T12:00:00.000Z",
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus-1");
  });

  it("dispatches a trial_converted email event when the renewal invoice matches trial_end", async () => {
    createServiceRoleClient.mockReturnValue(
      createAdminClient({
        user_id: "user-1",
        stripe_customer_id: "cus-1",
        stripe_pending_checkout_session_id: "cs-1",
      })
    );
    retrieveSubscription.mockResolvedValue({
      id: "sub-1",
      trial_start: 1_700_000_000,
      trial_end: 1_777_291_200,
      metadata: { is_trial: "true" },
      items: {
        data: [
          {
            current_period_start: 1_777_291_200,
            current_period_end: 1_808_827_200,
            price: { recurring: { interval: "year" } },
          },
        ],
      },
    });
    constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus-1",
          parent: { subscription_details: { subscription: "sub-1" } },
          billing_reason: "subscription_cycle",
          amount_paid: 1000,
          lines: {
            data: [
              {
                parent: { type: "subscription_item_details" },
                period: { start: 1_777_291_200, end: 1_808_827_200 },
              },
            ],
          },
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ meetings_used: 0 })
    );
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "resend-event:trial_converted:sub-1",
        name: "email/resend.trial-event",
        data: expect.objectContaining({
          resendEvent: "notura.trial_converted",
          userId: "user-1",
        }),
      })
    );
  });

  it("resets quota but does not dispatch trial_converted on a month-2 renewal invoice", async () => {
    retrieveSubscription.mockResolvedValue({
      id: "sub-1",
      trial_start: 1_700_000_000,
      trial_end: 1_700_000_000,
      metadata: { is_trial: "true" },
      items: {
        data: [
          {
            current_period_start: 1_777_291_200,
            current_period_end: 1_808_827_200,
            price: { recurring: { interval: "year" } },
          },
        ],
      },
    });
    constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus-1",
          parent: { subscription_details: { subscription: "sub-1" } },
          billing_reason: "subscription_cycle",
          amount_paid: 1000,
          lines: {
            data: [
              {
                parent: { type: "subscription_item_details" },
                period: { start: 1_777_291_200, end: 1_808_827_200 },
              },
            ],
          },
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ meetings_used: 0 })
    );
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("keeps a 200 response and the quota reset when inngest.send rejects on trial conversion", async () => {
    inngestSend.mockRejectedValueOnce(new Error("inngest unavailable"));
    createServiceRoleClient.mockReturnValue(
      createAdminClient({
        user_id: "user-1",
        stripe_customer_id: "cus-1",
        stripe_pending_checkout_session_id: "cs-1",
      })
    );
    retrieveSubscription.mockResolvedValue({
      id: "sub-1",
      trial_start: 1_700_000_000,
      trial_end: 1_777_291_200,
      metadata: { is_trial: "true" },
      items: {
        data: [
          {
            current_period_start: 1_777_291_200,
            current_period_end: 1_808_827_200,
            price: { recurring: { interval: "year" } },
          },
        ],
      },
    });
    constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer: "cus-1",
          parent: { subscription_details: { subscription: "sub-1" } },
          billing_reason: "subscription_cycle",
          amount_paid: 1000,
          lines: {
            data: [
              {
                parent: { type: "subscription_item_details" },
                period: { start: 1_777_291_200, end: 1_808_827_200 },
              },
            ],
          },
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ meetings_used: 0 })
    );
  });

  it("does not dispatch any trial email event on subscription cancellation", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("acknowledges failed Stripe invoice payments for support observability", async () => {
    constructEvent.mockReturnValue({
      id: "evt-payment-failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in-1",
          customer: "cus-1",
          billing_reason: "subscription_cycle",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).not.toHaveBeenCalled();
  });

  it("has a single invoice payment failed handler", () => {
    const source = readFileSync(resolve(__dirname, "route.ts"), "utf8");

    expect(source.match(/case "invoice\.payment_failed"/g)).toHaveLength(1);
  });

  it("downgrades deleted subscriptions without resetting consumed usage", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus-1",
        },
      },
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      })
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.not.objectContaining({
        meetings_used: expect.anything(),
      })
    );
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "free",
        current_period_start: null,
        current_period_end: null,
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus-1");
  });
});
