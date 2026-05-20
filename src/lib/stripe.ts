import Stripe from "stripe";
import type { Plan } from "@/types/database";
import { DEFAULT_BILLING_CYCLE, type BillingCycle } from "@/lib/pricing";

export { getAppBaseUrl } from "@/lib/app-url";

const STRIPE_PRICE_IDS: Partial<Record<Exclude<Plan, "free">, Record<BillingCycle, string | undefined>>> = {
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID,
    yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
  team: {
    monthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ?? process.env.STRIPE_TEAM_PRICE_ID,
    yearly: process.env.STRIPE_TEAM_YEARLY_PRICE_ID,
  },
};

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

export function getStripePriceId(
  plan: Plan,
  billingCycle: BillingCycle = DEFAULT_BILLING_CYCLE
): string {
  if (plan === "free") {
    throw new Error("Free plan does not use Stripe Checkout");
  }

  const priceId = STRIPE_PRICE_IDS[plan]?.[billingCycle];
  if (!priceId) {
    throw new Error(
      `Missing Stripe ${billingCycle} price ID for plan '${plan}'`
    );
  }

  return priceId;
}

export function isPaidCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.status === "complete" && session.payment_status === "paid";
}

export interface StripeSubscriptionBillingPeriod {
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

function readStripeTimestamp(value: unknown): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function readStripeBillingCycle(
  subscriptionItem: Stripe.SubscriptionItem | undefined
): BillingCycle | null {
  const interval = subscriptionItem?.price.recurring?.interval;
  if (interval === "month") return "monthly";
  if (interval === "year") return "yearly";
  return null;
}

export function getStripeSubscriptionBillingPeriod(
  subscription: Stripe.Subscription
): StripeSubscriptionBillingPeriod {
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodStart = readStripeTimestamp(
    subscriptionItem?.current_period_start
  );
  const currentPeriodEnd = readStripeTimestamp(subscriptionItem?.current_period_end);
  const billingCycle = readStripeBillingCycle(subscriptionItem);

  if (!billingCycle || !currentPeriodStart || !currentPeriodEnd) {
    throw new Error("Stripe subscription does not include a valid billing period.");
  }

  return {
    billingCycle,
    currentPeriodStart,
    currentPeriodEnd,
  };
}

export async function retrieveStripeSubscriptionBillingPeriod(
  subscriptionId: string
): Promise<StripeSubscriptionBillingPeriod> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  return getStripeSubscriptionBillingPeriod(subscription);
}
