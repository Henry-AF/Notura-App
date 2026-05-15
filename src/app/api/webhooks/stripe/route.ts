// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/stripe — Handle Stripe webhook events
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { withPublicRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  downgradeToFree,
  getOrCreateBillingAccount,
  resetSubscriptionPeriod,
} from "@/lib/billing";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type { Plan } from "@/types/database";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export const POST = withPublicRateLimit<NextRequest>(
  RATE_LIMIT_POLICIES.stripeWebhook,
  async (request: NextRequest) => {
    const startedAt = Date.now();
    const requestId = createTraceId();
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event: Stripe.Event;

  // ── Verify signature ─────────────────────────────────────────────────
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header." },
        { status: 400 }
      );
    }

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[stripe-webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  // ── Handle events ────────────────────────────────────────────────────
  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      // ── Checkout completed → activate plan ───────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan as Plan | undefined;

        if (!userId) {
          console.warn("[stripe-webhook] checkout.session.completed missing user_id in metadata");
          break;
        }

        const plan: Plan = planId === "team" ? "team" : "pro";
        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        const { data: existingBilling, error: existingBillingError } = await supabase
          .from("billing_accounts")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingBillingError) {
          throw new Error(
            `Failed to load billing account before webhook upsert: ${existingBillingError.message}`
          );
        }

        await getOrCreateBillingAccount(userId, supabase);
        await resetSubscriptionPeriod(
          {
            userId,
            plan,
            stripeCustomerId: existingBilling?.stripe_customer_id ?? stripeCustomerId ?? undefined,
          },
          supabase
        );
        console.log(`[stripe-webhook] User ${userId} upgraded to ${plan}`);
        break;
      }

      // ── Invoice paid → reset monthly usage ───────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;

        if (!customerId) {
          console.warn("[stripe-webhook] invoice.payment_succeeded missing customer ID");
          break;
        }

        // Only reset on subscription renewal, not on first payment
        if (invoice.billing_reason === "subscription_cycle") {
          await resetSubscriptionPeriod({ stripeCustomerId: customerId }, supabase);
          console.log(`[stripe-webhook] Reset meeting quota for customer ${customerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        const message = "Stripe invoice payment failed";

        logStructured("error", {
          event: "billing.stripe.payment_failed",
          requestId,
          route: "/api/webhooks/stripe",
          durationMs: Date.now() - startedAt,
          status: "payment_failed",
          stripeEventId: event.id,
          stripeEventType: event.type,
          stripeCustomerId: customerId,
          stripeInvoiceId: invoice.id,
        });
        captureObservedError(new Error(message), {
          event: "billing.stripe.payment_failed",
          requestId,
          route: "/api/webhooks/stripe",
          durationMs: Date.now() - startedAt,
          status: "payment_failed",
          extra: {
            stripeEventId: event.id,
            stripeEventType: event.type,
            stripeCustomerId: customerId,
            stripeInvoiceId: invoice.id,
            billingReason: invoice.billing_reason,
          },
        });
        break;
      }

      // ── Subscription deleted → downgrade to free ─────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null;

        if (!customerId) {
          console.warn("[stripe-webhook] customer.subscription.deleted missing customer ID");
          break;
        }

        await downgradeToFree({ stripeCustomerId: customerId }, supabase);
        console.log(`[stripe-webhook] Downgraded customer ${customerId} to free`);
        break;
      }

      default:
        // Unhandled event type — log and ignore
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[stripe-webhook] Error handling event:", error);
    captureObservedError(error, {
      event: "billing.stripe.webhook.failed",
      requestId,
      route: "/api/webhooks/stripe",
      durationMs: Date.now() - startedAt,
      status: 500,
      extra: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        errorMessage: message,
      },
    });
    return NextResponse.json(
      { error: "Failed to process Stripe webhook." },
      { status: 500 }
    );
  }

  // Always return 200 quickly to acknowledge receipt
  return NextResponse.json({ received: true }, { status: 200 });
  }
);
