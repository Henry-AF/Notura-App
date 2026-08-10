import type Stripe from "stripe";

/** Tolerance applied when comparing an invoice's cycle start against `subscription.trial_end`. */
const TRIAL_CONVERSION_PERIOD_TOLERANCE_SECONDS = 60;

/**
 * Returns the Unix timestamp (seconds) at which the billing cycle covered by this
 * invoice started, derived from the subscription line item with the earliest
 * `period.start`. `invoice.period_start` is intentionally not used — it describes
 * the accrual window for invoice items, not the subscription cycle start.
 */
export function getInvoiceCyclePeriodStart(invoice: Stripe.Invoice): number | null {
  const subscriptionLines = invoice.lines.data.filter(
    (line) => line.parent?.type === "subscription_item_details"
  );
  if (subscriptionLines.length === 0) return null;

  return subscriptionLines.reduce(
    (earliest, line) => Math.min(earliest, line.period.start),
    subscriptionLines[0].period.start
  );
}

function isAtTrialEnd(cyclePeriodStart: number, trialEnd: number): boolean {
  return Math.abs(cyclePeriodStart - trialEnd) <= TRIAL_CONVERSION_PERIOD_TOLERANCE_SECONDS;
}

/**
 * True only for the invoice that converts a Stripe trial into its first paid
 * cycle. Excludes the $0 invoice created at trial start (`subscription_create`),
 * proration invoices from upgrades (`subscription_update`), and every renewal
 * invoice after the conversion (their cycle start no longer matches `trial_end`).
 */
export function isTrialConversionInvoice(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription
): boolean {
  if (invoice.billing_reason !== "subscription_cycle") return false;
  if (invoice.amount_paid <= 0) return false;
  if (subscription.trial_end === null || subscription.trial_start === null) return false;
  if (subscription.metadata.is_trial !== "true") return false;

  const cyclePeriodStart = getInvoiceCyclePeriodStart(invoice);
  if (cyclePeriodStart === null) return false;

  return isAtTrialEnd(cyclePeriodStart, subscription.trial_end);
}
