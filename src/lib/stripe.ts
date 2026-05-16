import Stripe from "stripe";
import type { BillingCycle, CheckoutPlanType } from "@/lib/pricing";

export { getAppBaseUrl } from "@/lib/app-url";

const STRIPE_PRICE_IDS: Record<CheckoutPlanType, Partial<Record<BillingCycle, string>>> = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID,
    yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_TEAM_PRICE_ID,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
};

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

export function getStripePriceId(plan: CheckoutPlanType, billingCycle: BillingCycle): string {
  const priceId = STRIPE_PRICE_IDS[plan]?.[billingCycle];
  if (!priceId) {
    throw new Error(
      `Missing Stripe price ID for plan '${plan}' with billing cycle '${billingCycle}'`
    );
  }

  return priceId;
}

export function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === "complete" && session.payment_status === "paid";
}
