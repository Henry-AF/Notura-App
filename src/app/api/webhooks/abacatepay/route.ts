// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/abacatepay — Handle AbacatePay webhook events
//
// Webhook URL to register in AbacatePay dashboard:
//   https://<your-domain>/api/webhooks/abacatepay?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { withPublicRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseAbacatePayOnboardingExternalId } from "@/lib/abacatepay";

const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;

interface AbacatePayWebhookEvent {
  event: string;
  devMode?: boolean;
  data: {
    id?: string;
    externalId?: string;
    status?: string;
    customerId?: string;
    customer?: { id?: string };
    metadata?: Record<string, unknown>;
  };
}

export const POST = withPublicRateLimit<NextRequest>(
  RATE_LIMIT_POLICIES.abacatepayWebhook,
  async (request: NextRequest): Promise<NextResponse> => {
  const secret = request.nextUrl.searchParams.get("webhookSecret");
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    return new NextResponse(null, { status: 401 });
  }

  let event: AbacatePayWebhookEvent;
  try {
    event = (await request.json()) as AbacatePayWebhookEvent;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { event: eventType, data } = event;

  if (eventType === "billing.paid") {
    return handleBillingPaid(data);
  }

  if (eventType === "subscription.canceled") {
    return handleSubscriptionCanceled(data);
  }

  if (eventType === "subscription.renewed") {
    return handleSubscriptionRenewed(data);
  }

  return NextResponse.json({ received: true });
  }
);

async function handleBillingPaid(
  data: AbacatePayWebhookEvent["data"]
): Promise<NextResponse> {
  const externalId = data.externalId;
  if (!externalId) return NextResponse.json({ received: true });

  const parsed = parseAbacatePayOnboardingExternalId(externalId);
  if (!parsed) return NextResponse.json({ received: true });

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      plan: parsed.plan,
      abacatepay_pending_checkout_id: null,
      abacatepay_pending_plan: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", parsed.userId);

  if (error) {
    console.error("[webhook-abacatepay] billing.paid update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[webhook-abacatepay] billing.paid userId=${parsed.userId} plan=${parsed.plan}`);
  return NextResponse.json({ received: true });
}

async function handleSubscriptionCanceled(
  data: AbacatePayWebhookEvent["data"]
): Promise<NextResponse> {
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  if (data.externalId) {
    const parsed = parseAbacatePayOnboardingExternalId(data.externalId);
    if (parsed) {
      const { error } = await supabase
        .from("billing_accounts")
        .update({ plan: "free", updated_at: nowIso })
        .eq("user_id", parsed.userId);

      if (error) {
        console.error("[webhook-abacatepay] subscription.canceled by userId failed:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`[webhook-abacatepay] subscription.canceled userId=${parsed.userId}`);
      return NextResponse.json({ received: true });
    }
  }

  const customerId = data.customerId ?? data.customer?.id;
  if (customerId) {
    const { error } = await supabase
      .from("billing_accounts")
      .update({ plan: "free", updated_at: nowIso })
      .eq("abacatepay_customer_id", customerId);

    if (error) {
      console.error("[webhook-abacatepay] subscription.canceled by customerId failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[webhook-abacatepay] subscription.canceled customerId=${customerId}`);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionRenewed(
  data: AbacatePayWebhookEvent["data"]
): Promise<NextResponse> {
  const customerId = data.customerId ?? data.customer?.id;
  if (!customerId) return NextResponse.json({ received: true });

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      meetings_this_month: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("abacatepay_customer_id", customerId);

  if (error) {
    console.error("[webhook-abacatepay] subscription.renewed update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[webhook-abacatepay] subscription.renewed customerId=${customerId}`);
  return NextResponse.json({ received: true });
}
