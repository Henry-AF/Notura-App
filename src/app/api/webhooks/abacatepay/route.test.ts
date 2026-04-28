import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

function createAdminClient() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { plan: "team" },
    error: null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const from = vi.fn().mockReturnValue({ select, update });

  return {
    from,
    select,
    selectEq,
    update,
    updateEq,
  };
}

function createWebhookRequest(
  body: Record<string, unknown>,
  options: { headerSecret?: string; querySecret?: string } = {}
) {
  const url = new URL("http://localhost/api/webhooks/abacatepay");
  if (options.querySecret) {
    url.searchParams.set("webhookSecret", options.querySecret);
  }

  return new NextRequest(url.toString(), {
    method: "POST",
    headers: options.headerSecret
      ? { "x-abacatepay-secret": options.headerSecret }
      : undefined,
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/abacatepay", () => {
  const originalSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ABACATEPAY_WEBHOOK_SECRET = "webhook-secret";
    createServiceRoleClient.mockReturnValue(createAdminClient());
  });

  afterEach(() => {
    process.env.ABACATEPAY_WEBHOOK_SECRET = originalSecret;
  });

  it("authenticates requests with the x-abacatepay-secret header", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "ignored.event",
          data: {},
        },
        { headerSecret: "webhook-secret" }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("rejects webhook secrets sent through query string", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "ignored.event",
          data: {},
        },
        { querySecret: "webhook-secret" }
      )
    );

    expect(response.status).toBe(401);
  });

  it("activates the pending plan from subscription.completed v2 payloads", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "subscription.completed",
          apiVersion: 2,
          data: {
            subscription: {
              id: "subs-1",
              status: "ACTIVE",
            },
            customer: {
              id: "customer-1",
            },
            payment: {
              id: "payment-1",
              externalId: "onboarding:user-1:team:nonce-1",
              status: "PAID",
            },
            checkout: {
              id: "checkout-1",
              status: "PAID",
            },
          },
        },
        { headerSecret: "webhook-secret" }
      )
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(adminClient.from).toHaveBeenCalledWith("billing_accounts");
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "team",
        meetings_used: 0,
        current_period_start: expect.any(String),
        current_period_end: expect.any(String),
        abacatepay_customer_id: "customer-1",
        abacatepay_pending_checkout_id: null,
        abacatepay_pending_plan: null,
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("resets quota period from subscription.renewed payloads", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "subscription.renewed",
          data: {
            customer: {
              id: "customer-1",
            },
          },
        },
        { headerSecret: "webhook-secret" }
      )
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        meetings_used: 0,
        current_period_start: expect.any(String),
        current_period_end: expect.any(String),
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith(
      "abacatepay_customer_id",
      "customer-1"
    );
  });

  it("applies the renewed plan when subscription.renewed includes an external id", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "subscription.renewed",
          data: {
            subscription: {
              externalId: "onboarding:user-1:team:nonce-1",
              customerId: "customer-1",
            },
          },
        },
        { headerSecret: "webhook-secret" }
      )
    );

    const adminClient = createServiceRoleClient.mock.results[0]?.value;
    expect(response.status).toBe(200);
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "team",
        meetings_used: 0,
        current_period_start: expect.any(String),
        current_period_end: expect.any(String),
        abacatepay_customer_id: "customer-1",
        abacatepay_pending_checkout_id: null,
        abacatepay_pending_plan: null,
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("downgrades canceled subscriptions without resetting consumed usage", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "subscription.canceled",
          data: {
            customer: {
              id: "customer-1",
            },
          },
        },
        { headerSecret: "webhook-secret" }
      )
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
    expect(adminClient.updateEq).toHaveBeenCalledWith(
      "abacatepay_customer_id",
      "customer-1"
    );
  });
});
