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
import { downgradeToFree, resetSubscriptionPeriod } from "@/lib/billing";

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
    subscription?: {
      id?: string;
      externalId?: string;
      status?: string;
      customerId?: string;
      metadata?: Record<string, unknown>;
    };
    payment?: {
      id?: string;
      externalId?: string;
      status?: string;
      customerId?: string;
      metadata?: Record<string, unknown>;
    };
    checkout?: {
      id?: string;
      externalId?: string;
      status?: string;
      customerId?: string;
      metadata?: Record<string, unknown>;
    };
    metadata?: Record<string, unknown>;
  };
}

function readEventExternalId(data: AbacatePayWebhookEvent["data"]): string | undefined {
  return (
    data.externalId ??
    data.payment?.externalId ??
    data.checkout?.externalId ??
    data.subscription?.externalId
  );
}

function readEventCustomerId(data: AbacatePayWebhookEvent["data"]): string | undefined {
  return (
    data.customerId ??
    data.customer?.id ??
    data.payment?.customerId ??
    data.checkout?.customerId ??
    data.subscription?.customerId
  );
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

  if (eventType === "billing.paid" || eventType === "subscription.completed") {
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
  const externalId = readEventExternalId(data);
  if (!externalId) return NextResponse.json({ received: true });

  const parsed = parseAbacatePayOnboardingExternalId(externalId);
  if (!parsed) return NextResponse.json({ received: true });

  const customerId = readEventCustomerId(data);
  const supabase = createServiceRoleClient();
  try {
    await resetSubscriptionPeriod(
      {
        userId: parsed.userId,
        plan: parsed.plan,
        abacatepayCustomerId: customerId,
        clearAbacatePayPending: true,
      },
      supabase
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[webhook-abacatepay] billing.paid update failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log(`[webhook-abacatepay] billing.paid userId=${parsed.userId} plan=${parsed.plan}`);
  return NextResponse.json({ received: true });
}

async function handleSubscriptionCanceled(
  data: AbacatePayWebhookEvent["data"]
): Promise<NextResponse> {
  const supabase = createServiceRoleClient();

  if (data.externalId) {
    const parsed = parseAbacatePayOnboardingExternalId(data.externalId);
    if (parsed) {
      try {
        await downgradeToFree({ userId: parsed.userId }, supabase);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error("[webhook-abacatepay] subscription.canceled by userId failed:", message);
        return NextResponse.json({ error: message }, { status: 500 });
      }

      console.log(`[webhook-abacatepay] subscription.canceled userId=${parsed.userId}`);
      return NextResponse.json({ received: true });
    }
  }

  const customerId = readEventCustomerId(data);
  if (customerId) {
    try {
      await downgradeToFree({ abacatepayCustomerId: customerId }, supabase);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[webhook-abacatepay] subscription.canceled by customerId failed:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    console.log(`[webhook-abacatepay] subscription.canceled customerId=${customerId}`);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionRenewed(
  data: AbacatePayWebhookEvent["data"]
): Promise<NextResponse> {
  const customerId = readEventCustomerId(data);
  if (!customerId) return NextResponse.json({ received: true });

  const supabase = createServiceRoleClient();
  try {
    await resetSubscriptionPeriod({ abacatepayCustomerId: customerId }, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[webhook-abacatepay] subscription.renewed update failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log(`[webhook-abacatepay] subscription.renewed customerId=${customerId}`);
  return NextResponse.json({ received: true });
}
