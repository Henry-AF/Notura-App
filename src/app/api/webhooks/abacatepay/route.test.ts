import { createHmac } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AdminClient {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  selectEq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateEq: ReturnType<typeof vi.fn>;
}

const createServiceRoleClient = vi.fn<() => AdminClient>();
const inngestSend = vi.fn<(event: unknown) => Promise<void>>();
let adminClient: AdminClient;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: inngestSend,
  },
}));

function createAdminClient(
  existingAccount: Record<string, unknown> = {
    user_id: "user-1",
    plan: "team",
    current_period_end: "2026-05-27T12:00:00.000Z",
  }
): AdminClient {
  const updateQuery = {
    eq: vi.fn(),
    then: vi.fn(),
  };
  updateQuery.eq.mockReturnValue(updateQuery);
  updateQuery.then.mockImplementation((resolve) => resolve({ error: null }));
  const update = vi.fn().mockReturnValue(updateQuery);
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingAccount,
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
    updateEq: updateQuery.eq,
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
    adminClient = createAdminClient({
      user_id: "user-1",
      plan: "free",
      current_period_end: null,
      abacatepay_pending_checkout_id: "subs-1",
    });
    createServiceRoleClient.mockReturnValue(adminClient);

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

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    const activationPayload = adminClient.update.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(adminClient.from).toHaveBeenCalledWith("billing_accounts");
    expect(activationPayload.current_period_start).toEqual(expect.any(String));
    expect(activationPayload.current_period_end).toEqual(expect.any(String));
    expect(adminClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "team",
        meetings_used: 0,
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

  it("enqueues renewal confirmation from subscription.renewed payloads", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      createWebhookRequest(
        {
          event: "subscription.renewed",
          data: {
            currentPeriodEnd: "2026-05-27T12:00:00.000Z",
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

    expect(response.status).toBe(200);
    expect(inngestSend).toHaveBeenCalledWith({
      id: "renewal-confirmed:user-1:2026-05-27T12:00:00.000Z",
      name: "billing/abacatepay.renewal-confirmed",
      data: {
        userId: "user-1",
        plan: "team",
        currentPeriodEnd: "2026-05-27T12:00:00.000Z",
        customerId: "customer-1",
      },
    });
    expect(adminClient.update).not.toHaveBeenCalled();
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
              currentPeriodEnd: "2026-05-27T12:00:00.000Z",
            },
          },
        },
        {
          querySecret: "webhook-secret",
          signatureKey: "abacatepay-public-key",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(inngestSend).toHaveBeenCalledWith({
      id: "renewal-confirmed:user-1:2026-05-27T12:00:00.000Z",
      name: "billing/abacatepay.renewal-confirmed",
      data: {
        userId: "user-1",
        plan: "team",
        currentPeriodEnd: "2026-05-27T12:00:00.000Z",
        customerId: "customer-1",
      },
    });
    expect(adminClient.update).not.toHaveBeenCalled();
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

    expect(response.status).toBe(200);
    const usedClient = createServiceRoleClient.mock.results[0]?.value as AdminClient;
    const cancelPayload = usedClient.update.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(cancelPayload).not.toHaveProperty("meetings_used");
    expect(usedClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "free",
        current_period_start: null,
        current_period_end: null,
      })
    );
    expect(usedClient.updateEq).toHaveBeenCalledWith(
      "abacatepay_customer_id",
      "customer-1"
    );
  });
});
