// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/stripe — Handle Stripe webhook events
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: NextRequest) {
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

        const { error } = await supabase
          .from("profiles")
          .update({
            plan,
            stripe_customer_id: stripeCustomerId,
          })
          .eq("id", userId);

        if (error) {
          console.error("[stripe-webhook] Failed to update profile plan:", error);
        } else {
          console.log(`[stripe-webhook] User ${userId} upgraded to ${plan}`);
        }
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
          const { error } = await supabase
            .from("profiles")
            .update({ meetings_this_month: 0 })
            .eq("stripe_customer_id", customerId);

          if (error) {
            console.error("[stripe-webhook] Failed to reset meetings_this_month:", error);
          } else {
            console.log(`[stripe-webhook] Reset monthly meetings for customer ${customerId}`);
          }
        }
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

        const { error } = await supabase
          .from("profiles")
          .update({ plan: "free" as Plan })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error("[stripe-webhook] Failed to downgrade profile:", error);
        } else {
          console.log(`[stripe-webhook] Downgraded customer ${customerId} to free`);
        }
        break;
      }

      default:
        // Unhandled event type — log and ignore
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("[stripe-webhook] Error handling event:", error);
    // Still return 200 to prevent Stripe from retrying
  }

  // Always return 200 quickly to acknowledge receipt
  return NextResponse.json({ received: true }, { status: 200 });
}
