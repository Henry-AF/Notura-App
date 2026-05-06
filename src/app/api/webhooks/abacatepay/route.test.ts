import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();
const inngestSend = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: inngestSend,
  },
}));

function createAdminClient() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { user_id: "user-from-customer", plan: "team" },
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
  options: {
    headerSecret?: string;
    querySecret?: string;
    signatureKey?: string;
    signatureBody?: string;
  } = {}
) {
  const url = new URL("http://localhost/api/webhooks/abacatepay");
  if (options.querySecret) {
    url.searchParams.set("webhookSecret", options.querySecret);
  }
  const rawBody = JSON.stringify(body);
  const signaturePayload = options.signatureBody ?? rawBody;
  const signature = options.signatureKey
    ? createHmac("sha256", options.signatureKey)
        .update(signaturePayload, "utf8")
        .digest("base64")
    : undefined;

  return new NextRequest(url.toString(), {
    method: "POST",
    headers: {
      ...(options.headerSecret ? { "x-abacatepay-secret": options.headerSecret } : {}),
      ...(signature ? { "x-webhook-signature": signature } : {}),
    },
    body: rawBody,
  });
}

describe("POST /api/webhooks/abacatepay", () => {
  const originalSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  const originalPublicKey = process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ABACATEPAY_WEBHOOK_SECRET = "webhook-secret";
    process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = "abacatepay-public-key";
    createServiceRoleClient.mockReturnValue(createAdminClient());
    inngestSend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.ABACATEPAY_WEBHOOK_SECRET = originalSecret;
    process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = originalPublicKey;
  });

  it("authenticates requests with webhookSecret query param and HMAC signature", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "ignored.event",
          data: {},
        },
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("rejects webhook requests with an invalid HMAC signature", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "ignored.event",
          data: {},
        },
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
          signatureBody: JSON.stringify({ event: "ignored.event", data: { tampered: true } }),
        }
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
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
        }
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
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing/abacatepay.renew",
        data: { userId: "user-1", attempt: 1 },
        ts: expect.any(Number),
      })
    );
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
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
        }
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
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing/abacatepay.renew",
        data: { userId: "user-from-customer", attempt: 1 },
        ts: expect.any(Number),
      })
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
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
        }
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
          event: "subscription.cancelled",
          data: {
            customer: {
              id: "customer-1",
            },
          },
        },
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
        }
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
