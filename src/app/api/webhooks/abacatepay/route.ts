// POST /api/webhooks/abacatepay
// AbacatePay sends webhookSecret in the URL and signs the raw request body
// with X-Webhook-Signature.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withPublicRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseAbacatePayOnboardingExternalId } from "@/lib/abacatepay";
import {
  downgradeToFree,
  getBillingRenewalContext,
  resetSubscriptionPeriod,
} from "@/lib/billing";
import { inngest } from "@/lib/inngest";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type { Plan } from "@/types/database";

const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;
const WEBHOOK_PUBLIC_KEY = process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY;

interface AbacatePayWebhookEvent {
  event: string;
  devMode?: boolean;
  data: {
    id?: string;
    externalId?: string;
    status?: string;
    currentPeriodEnd?: string;
    current_period_end?: string;
    previousPeriodEnd?: string;
    previous_period_end?: string;
    customerId?: string;
    customer?: { id?: string };
    subscription?: {
      id?: string;
      externalId?: string;
      status?: string;
      customerId?: string;
      currentPeriodEnd?: string;
      current_period_end?: string;
      previousPeriodEnd?: string;
      previous_period_end?: string;
      metadata?: Record<string, unknown>;
    };
    payment?: {
      id?: string;
      externalId?: string;
      status?: string;
      customerId?: string;
      currentPeriodEnd?: string;
      current_period_end?: string;
      previousPeriodEnd?: string;
      previous_period_end?: string;
      metadata?: Record<string, unknown>;
    };
    checkout?: {
      id?: string;
      externalId?: string;
      status?: string;
      customerId?: string;
      currentPeriodEnd?: string;
      current_period_end?: string;
      previousPeriodEnd?: string;
      previous_period_end?: string;
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

function signWebhookBody(rawBody: string, publicKey: string): string {
  return createHmac("sha256", publicKey)
    .update(rawBody, "utf8")
    .digest("base64");
}

function verifyWebhookSignature(
  rawBody: string,
  incomingSignature: string,
  publicKey: string | undefined
): boolean {
  if (!publicKey || !incomingSignature) return false;
  return safeEqual(incomingSignature, signWebhookBody(rawBody, publicKey));
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

type PeriodEndSource = {
  currentPeriodEnd?: string;
  current_period_end?: string;
  previousPeriodEnd?: string;
  previous_period_end?: string;
  metadata?: Record<string, unknown>;
};

interface ResolvedRenewalContext {
  userId: string;
  plan: Exclude<Plan, "free">;
  currentPeriodEnd: string;
  customerId?: string;
}

type ParsedOnboardingExternalId = NonNullable<
  ReturnType<typeof parseAbacatePayOnboardingExternalId>
>;

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function readPeriodEnd(source: PeriodEndSource | undefined): string | undefined {
  if (!source) return undefined;

  return (
    source.currentPeriodEnd ??
    source.current_period_end ??
    source.previousPeriodEnd ??
    source.previous_period_end ??
    readMetadataString(source.metadata, "currentPeriodEnd") ??
    readMetadataString(source.metadata, "current_period_end") ??
    readMetadataString(source.metadata, "previousPeriodEnd") ??
    readMetadataString(source.metadata, "previous_period_end")
  );
}

function readEventCurrentPeriodEnd(
  data: AbacatePayWebhookEvent["data"]
): string | undefined {
  return (
    readPeriodEnd(data) ??
    readPeriodEnd(data.subscription) ??
    readPeriodEnd(data.payment) ??
    readPeriodEnd(data.checkout)
  );
}

function isFuturePeriodEnd(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function resolveUsablePeriodEnd(
  eventPeriodEnd: string | undefined,
  fallbackPeriodEnd: string | null | undefined
): string | null {
  const currentPeriodEnd = eventPeriodEnd ?? fallbackPeriodEnd ?? null;
  if (!currentPeriodEnd) return null;
  if (!eventPeriodEnd && isFuturePeriodEnd(currentPeriodEnd)) return null;
  return currentPeriodEnd;
}

function isAbacatePayFailureEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  const isBillingEvent =
    normalized.includes("billing") ||
    normalized.includes("payment") ||
    normalized.includes("subscription") ||
    normalized.includes("checkout");
  const isFailure =
    normalized.includes("failed") ||
    normalized.includes("failure") ||
    normalized.includes("expired") ||
    normalized.includes("overdue");

  return isBillingEvent && isFailure;
}

function captureAbacatePayWebhookFailure(
  eventType: string,
  data: AbacatePayWebhookEvent["data"],
  requestId: string,
  startedAt: number
): void {
  const externalId = readEventExternalId(data);
  const customerId = readEventCustomerId(data);
  const error = new Error(`AbacatePay billing failure event received: ${eventType}`);

  logStructured("error", {
    event: "billing.abacatepay.payment_failed",
    requestId,
    route: "/api/webhooks/abacatepay",
    durationMs: Date.now() - startedAt,
    status: "payment_failed",
    abacatepayEventType: eventType,
    abacatepayCustomerId: customerId,
  });
  captureObservedError(error, {
    event: "billing.abacatepay.payment_failed",
    requestId,
    route: "/api/webhooks/abacatepay",
    durationMs: Date.now() - startedAt,
    status: "payment_failed",
    extra: {
      abacatepayEventType: eventType,
      externalId,
      customerId,
      paymentId: data.payment?.id,
      checkoutId: data.checkout?.id,
      subscriptionId: data.subscription?.id ?? data.id,
    },
  });
}

export const POST = withPublicRateLimit<NextRequest>(
  RATE_LIMIT_POLICIES.abacatepayWebhook,
  async (request: NextRequest): Promise<NextResponse> => {
  const startedAt = Date.now();
  const requestId = createTraceId();
  const incomingSecret =
    new URL(request.url).searchParams.get("webhookSecret") ?? "";
  if (!WEBHOOK_SECRET || !safeEqual(incomingSecret, WEBHOOK_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }

  const rawBody = await request.text();
  const incomingSignature = request.headers.get("x-webhook-signature") ?? "";
  if (!verifyWebhookSignature(rawBody, incomingSignature, WEBHOOK_PUBLIC_KEY)) {
    return new NextResponse(null, { status: 401 });
  }

  let event: AbacatePayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as AbacatePayWebhookEvent;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { event: eventType, data } = event;

  if (isAbacatePayFailureEvent(eventType)) {
    captureAbacatePayWebhookFailure(eventType, data, requestId, startedAt);
    return NextResponse.json({ received: true });
  }

  if (eventType === "billing.paid" || eventType === "subscription.completed") {
    return handleBillingPaid(data);
  }

  if (eventType === "subscription.canceled" || eventType === "subscription.cancelled") {
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
  const subscriptionId = data.subscription?.id ?? data.id;
  const params = {
    userId: parsed.userId,
    plan: parsed.plan,
    clearAbacatePayPending: true,
    ...(subscriptionId ? { abacatepaySubscriptionId: subscriptionId } : {}),
    ...(customerId ? { abacatepayCustomerId: customerId } : {}),
  };

  const supabase = createServiceRoleClient();
  try {
    await resetSubscriptionPeriod(params, supabase);
  } catch (error) {
    const requestId = createTraceId();
    const message = getErrorMessage(error);
    console.error("[webhook-abacatepay] billing.paid update failed:", message);
    captureObservedError(error, {
      event: "billing.abacatepay.webhook_apply.failed",
      requestId,
      userId: parsed.userId,
      route: "/api/webhooks/abacatepay",
      durationMs: 0,
      status: 500,
      extra: {
        abacatepayEventType: "billing.paid",
        plan: parsed.plan,
        customerId,
        subscriptionId,
      },
    });
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
        await downgradeToFree(
          { userId: parsed.userId, activeProvider: "abacatepay" },
          supabase
        );
      } catch (error) {
        const requestId = createTraceId();
        const message = getErrorMessage(error);
        console.error("[webhook-abacatepay] subscription.canceled by userId failed:", message);
        captureObservedError(error, {
          event: "billing.abacatepay.subscription_cancel.failed",
          requestId,
          userId: parsed.userId,
          route: "/api/webhooks/abacatepay",
          durationMs: 0,
          status: 500,
          extra: {
            abacatepayEventType: "subscription.canceled",
          },
        });
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
      const requestId = createTraceId();
      const message = getErrorMessage(error);
      console.error("[webhook-abacatepay] subscription.canceled by customerId failed:", message);
      captureObservedError(error, {
        event: "billing.abacatepay.subscription_cancel.failed",
        requestId,
        route: "/api/webhooks/abacatepay",
        durationMs: 0,
        status: 500,
        extra: {
          abacatepayEventType: "subscription.canceled",
          customerId,
        },
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    console.log(`[webhook-abacatepay] subscription.canceled customerId=${customerId}`);
  }

  return NextResponse.json({ received: true });
}

async function resolveParsedRenewalContext(
  parsed: ParsedOnboardingExternalId,
  eventPeriodEnd: string | undefined,
  customerId: string | undefined,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<ResolvedRenewalContext | null> {
  const context = await getBillingRenewalContext({ userId: parsed.userId }, supabase);
  const currentPeriodEnd = resolveUsablePeriodEnd(
    eventPeriodEnd,
    context?.currentPeriodEnd
  );
  if (!currentPeriodEnd) return null;

  return {
    userId: parsed.userId,
    plan: parsed.plan,
    currentPeriodEnd,
    ...(customerId ? { customerId } : {}),
  };
}

async function resolveCustomerRenewalContext(
  customerId: string,
  eventPeriodEnd: string | undefined,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<ResolvedRenewalContext | null> {
  const context = await getBillingRenewalContext(
    { abacatepayCustomerId: customerId },
    supabase
  );
  if (!context) return null;

  const currentPeriodEnd = resolveUsablePeriodEnd(
    eventPeriodEnd,
    context.currentPeriodEnd
  );
  if (!currentPeriodEnd) return null;

  return {
    userId: context.userId,
    plan: context.plan,
    currentPeriodEnd,
    customerId,
  };
}

async function resolveRenewalContext(
  data: AbacatePayWebhookEvent["data"],
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<ResolvedRenewalContext | null> {
  const eventPeriodEnd = readEventCurrentPeriodEnd(data);
  const customerId = readEventCustomerId(data);
  const externalId = readEventExternalId(data);
  const parsed = externalId
    ? parseAbacatePayOnboardingExternalId(externalId)
    : null;

  if (parsed) {
    return resolveParsedRenewalContext(parsed, eventPeriodEnd, customerId, supabase);
  }

  if (!customerId) return null;
  return resolveCustomerRenewalContext(customerId, eventPeriodEnd, supabase);
}

async function handleSubscriptionRenewed(
  data: AbacatePayWebhookEvent["data"]
): Promise<NextResponse> {
  const supabase = createServiceRoleClient();

  try {
    const renewal = await resolveRenewalContext(data, supabase);
    if (!renewal) return NextResponse.json({ received: true });

    const eventId = `renewal-confirmed:${renewal.userId}:${renewal.currentPeriodEnd}`;
    await inngest.send({
      id: eventId,
      name: "billing/abacatepay.renewal-confirmed",
      data: {
        userId: renewal.userId,
        plan: renewal.plan,
        currentPeriodEnd: renewal.currentPeriodEnd,
        ...(renewal.customerId ? { customerId: renewal.customerId } : {}),
      },
    });
    console.log(`[webhook-abacatepay] subscription.renewed eventId=${eventId}`);
  } catch (error) {
    const requestId = createTraceId();
    const message = getErrorMessage(error);
    console.error("[webhook-abacatepay] subscription.renewed enqueue failed:", message);
    captureObservedError(error, {
      event: "billing.abacatepay.renewal_enqueue.failed",
      requestId,
      route: "/api/webhooks/abacatepay",
      durationMs: 0,
      status: 500,
      extra: {
        abacatepayEventType: "subscription.renewed",
        externalId: readEventExternalId(data),
        customerId: readEventCustomerId(data),
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
