import Stripe from "stripe";
import type { Plan } from "@/types/database";

export { getAppBaseUrl } from "@/lib/app-url";

const STRIPE_PRICE_IDS: Partial<Record<Plan, string>> = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  team: process.env.STRIPE_TEAM_PRICE_ID,
};

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

export function getStripePriceId(plan: Plan): string {
  if (plan === "free") {
    throw new Error("Free plan does not use Stripe Checkout");
  }

  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for plan '${plan}'`);
  }

  return priceId;
}

export function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === "complete" && session.payment_status === "paid";
}
