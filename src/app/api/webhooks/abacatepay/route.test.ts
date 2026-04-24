import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

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

  it("activates the pending plan from subscription.completed v2 payloads", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new NextRequest(
        "http://localhost/api/webhooks/abacatepay?webhookSecret=webhook-secret",
        {
          method: "POST",
          body: JSON.stringify({
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
          }),
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
        abacatepay_customer_id: "customer-1",
        abacatepay_pending_checkout_id: null,
        abacatepay_pending_plan: null,
      })
    );
    expect(adminClient.updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
