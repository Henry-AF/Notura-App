import { describe, expect, it } from "vitest";
import { getInvoiceCyclePeriodStart, isTrialConversionInvoice } from "./trial-conversion";
import type Stripe from "stripe";

const TRIAL_END = 1_700_000_000;
const TRIAL_START = 1_699_000_000;
const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60;

function buildLine(periodStart: number, isSubscriptionLine = true) {
  return {
    period: { start: periodStart, end: periodStart + ONE_MONTH_SECONDS },
    parent: isSubscriptionLine ? { type: "subscription_item_details" } : { type: "invoice_item_details" },
  } as unknown as Stripe.InvoiceLineItem;
}

function buildInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    billing_reason: "subscription_cycle",
    amount_paid: 1000,
    lines: { data: [buildLine(TRIAL_END)] },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

function buildSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    trial_start: TRIAL_START,
    trial_end: TRIAL_END,
    metadata: { is_trial: "true" },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("getInvoiceCyclePeriodStart", () => {
  it("returns null when there are no line items", () => {
    const invoice = buildInvoice({ lines: { data: [] } as never });
    expect(getInvoiceCyclePeriodStart(invoice)).toBeNull();
  });

  it("picks the subscription line with the earliest period.start", () => {
    const invoice = buildInvoice({
      lines: {
        data: [buildLine(TRIAL_END + 100), buildLine(TRIAL_END)],
      } as never,
    });
    expect(getInvoiceCyclePeriodStart(invoice)).toBe(TRIAL_END);
  });

  it("ignores non-subscription lines even when they start earlier", () => {
    const invoice = buildInvoice({
      lines: {
        data: [buildLine(TRIAL_END - ONE_MONTH_SECONDS, false), buildLine(TRIAL_END)],
      } as never,
    });
    expect(getInvoiceCyclePeriodStart(invoice)).toBe(TRIAL_END);
  });

  it("returns null when every line is a non-subscription line", () => {
    const invoice = buildInvoice({
      lines: { data: [buildLine(TRIAL_END, false)] } as never,
    });
    expect(getInvoiceCyclePeriodStart(invoice)).toBeNull();
  });
});

describe("isTrialConversionInvoice", () => {
  it("(1) is a conversion when cycle + paid + period.start === trial_end + is_trial metadata", () => {
    const invoice = buildInvoice();
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(true);
  });

  it("(2) is not a conversion when period.start is trial_end + 30 days (month 2 renewal)", () => {
    const invoice = buildInvoice({
      lines: { data: [buildLine(TRIAL_END + ONE_MONTH_SECONDS)] } as never,
    });
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it("(3) is not a conversion for subscription_create with amount_paid 0", () => {
    const invoice = buildInvoice({ billing_reason: "subscription_create", amount_paid: 0 });
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it("(4) is not a conversion for subscription_update (upgrade proration)", () => {
    const invoice = buildInvoice({ billing_reason: "subscription_update" });
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it("(5) is not a conversion when trial_end is null", () => {
    const invoice = buildInvoice();
    const subscription = buildSubscription({ trial_end: null });
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it("(6) is not a conversion when amount_paid is 0 even with subscription_cycle", () => {
    const invoice = buildInvoice({ amount_paid: 0 });
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it("(7) is not a conversion when metadata.is_trial is absent", () => {
    const invoice = buildInvoice();
    const subscription = buildSubscription({ metadata: {} });
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it("(8) is not a conversion when lines.data is empty, without crashing", () => {
    const invoice = buildInvoice({ lines: { data: [] } as never });
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(false);
  });

  it.each([
    ["59s before trial_end", TRIAL_END - 59, true],
    ["59s after trial_end", TRIAL_END + 59, true],
    ["61s before trial_end", TRIAL_END - 61, false],
    ["61s after trial_end", TRIAL_END + 61, false],
  ])("(9) tolerance window is symmetric: %s -> %s", (_label, periodStart, expected) => {
    const invoice = buildInvoice({ lines: { data: [buildLine(periodStart)] } as never });
    const subscription = buildSubscription();
    expect(isTrialConversionInvoice(invoice, subscription)).toBe(expected);
  });
});
