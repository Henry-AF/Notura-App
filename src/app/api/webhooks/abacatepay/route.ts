// POST /api/webhooks/abacatepay
// Register the webhook URL without query params and send the shared secret in
// the x-abacatepay-secret header.

import { timingSafeEqual } from "crypto";
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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
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
  const incomingSecret = request.headers.get("x-abacatepay-secret") ?? "";
  if (!WEBHOOK_SECRET || !safeEqual(incomingSecret, WEBHOOK_SECRET)) {
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
  const params = {
    userId: parsed.userId,
    plan: parsed.plan,
    clearAbacatePayPending: true,
    ...(customerId ? { abacatepayCustomerId: customerId } : {}),
  };

  const supabase = createServiceRoleClient();
  try {
    await resetSubscriptionPeriod(params, supabase);
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
  const externalId = readEventExternalId(data);
  const parsed = externalId
    ? parseAbacatePayOnboardingExternalId(externalId)
    : null;
  const customerId = readEventCustomerId(data);
  if (!customerId && !parsed) return NextResponse.json({ received: true });

  const supabase = createServiceRoleClient();
  const params = parsed
    ? {
        userId: parsed.userId,
        plan: parsed.plan,
        clearAbacatePayPending: true,
        ...(customerId ? { abacatepayCustomerId: customerId } : {}),
      }
    : { abacatepayCustomerId: customerId as string };

  try {
    await resetSubscriptionPeriod(params, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[webhook-abacatepay] subscription.renewed update failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log(
    `[webhook-abacatepay] subscription.renewed customerId=${customerId ?? "unknown"}`
  );
  return NextResponse.json({ received: true });
}
