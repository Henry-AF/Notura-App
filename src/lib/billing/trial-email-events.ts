import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { loadUserIdByStripeCustomerId } from "@/lib/billing";
import { isTrialConversionInvoice } from "@/lib/billing/trial-conversion";
import { inngest } from "@/lib/inngest";
import {
  captureObservedError,
  logStructured,
} from "@/lib/observability";
import { recordReferralConversion } from "@/lib/referrals";
import type { NoturaResendEventName } from "@/lib/resend";
import { readInvoiceSubscriptionId } from "@/lib/stripe";
import type { Database } from "@/types/database";

export const RESEND_TRIAL_EVENT_NAME = "email/resend.trial-event";

export type TrialEmailClaimColumn =
  | "trial_started_email_event_at"
  | "trial_converted_email_event_at";

export interface ResendTrialEventData {
  resendEvent: NoturaResendEventName;
  userId: string;
  claimColumn: TrialEmailClaimColumn;
  payload: Record<string, string>;
}

// These dispatchers are called from inside the Stripe webhook handler (and
// from the trial checkout verification path). If `inngest.send` threw here,
// it would bubble up into the webhook's top-level catch, return a 500, and
// make Stripe redeliver the event — re-running resetSubscriptionPeriod /
// downgradeToFree and risking corrupted billing state over what is only a
// best-effort notification. The try/catch below exists specifically to keep
// this failure domain isolated from the NOT-94 billing flow.
async function sendTrialEmailEvent(id: string, data: ResendTrialEventData): Promise<void> {
  try {
    await inngest.send({ id, name: RESEND_TRIAL_EVENT_NAME, data });
  } catch (error) {
    logStructured("warn", {
      event: "billing.trial_email.dispatch_failed",
      requestId: id,
      route: "lib.billing.trial-email-events",
      durationMs: 0,
      status: "dispatch_failed",
      userId: data.userId,
    });
    captureObservedError(error, {
      event: "billing.trial_email.dispatch_failed",
      requestId: id,
      route: "lib.billing.trial-email-events",
      durationMs: 0,
      status: "dispatch_failed",
      userId: data.userId,
      extra: { resendEvent: data.resendEvent },
    });
  }
}

export async function dispatchTrialStartedEmailEvent(input: {
  userId: string;
  stripeSubscriptionId: string;
  trialStartAt: string;
  trialEndAt: string;
}): Promise<void> {
  await sendTrialEmailEvent(`resend-event:trial_started:${input.stripeSubscriptionId}`, {
    resendEvent: "notura.trial_started",
    userId: input.userId,
    claimColumn: "trial_started_email_event_at",
    payload: {
      user_id: input.userId,
      trial_start_at: input.trialStartAt,
      trial_end_at: input.trialEndAt,
    },
  });
}

export async function dispatchTrialConvertedEmailEvent(input: {
  userId: string;
  stripeSubscriptionId: string;
  convertedAt: string;
}): Promise<void> {
  await sendTrialEmailEvent(`resend-event:trial_converted:${input.stripeSubscriptionId}`, {
    resendEvent: "notura.trial_converted",
    userId: input.userId,
    claimColumn: "trial_converted_email_event_at",
    payload: {
      user_id: input.userId,
      converted_at: input.convertedAt,
    },
  });
}

export interface MaybeDispatchTrialConvertedEmailEventInput {
  stripe: Stripe;
  supabase: SupabaseClient<Database>;
  invoice: Stripe.Invoice;
  customerId: string;
  requestId: string;
}

async function resolveTrialConversionUserId(
  input: MaybeDispatchTrialConvertedEmailEventInput
): Promise<string | null> {
  const userId = await loadUserIdByStripeCustomerId(input.supabase, input.customerId);
  if (userId) return userId;

  logStructured("warn", {
    event: "billing.trial_email.user_not_found",
    requestId: input.requestId,
    route: "lib.billing.trial-email-events",
    durationMs: 0,
    status: "user_not_found",
  });
  return null;
}

// Same isolation rationale as `sendTrialEmailEvent` above: this orchestrator
// runs inline in the invoice.payment_succeeded webhook handler, after the
// NOT-94 quota reset has already succeeded. Nothing in this function may be
// allowed to throw back into the webhook's catch block.
export async function maybeDispatchTrialConvertedEmailEvent(
  input: MaybeDispatchTrialConvertedEmailEventInput
): Promise<void> {
  try {
    if (input.invoice.billing_reason !== "subscription_cycle") return;

    const subscriptionId = readInvoiceSubscriptionId(input.invoice);
    if (!subscriptionId) return;

    // Isolated, separate retrieve call — intentionally not shared with the
    // subscription lookup used by the billing/quota-reset path so a Resend
    // failure can never affect NOT-94's billing behavior.
    const subscription = await input.stripe.subscriptions.retrieve(subscriptionId);
    if (!isTrialConversionInvoice(input.invoice, subscription)) return;

    const userId = await resolveTrialConversionUserId(input);
    if (!userId) return;

    // Real payment signal for a trial: this is the correct place to credit
    // an influencer's referral, not checkout.session.completed (trial start
    // only attaches a card, no charge yet — see maybeRecordReferralConversion
    // in lib/billing.ts). Isolated in its own try/catch so a referral failure
    // can never prevent the trial_converted email below from being sent —
    // same failure-isolation rule as the rest of this function.
    try {
      await recordReferralConversion(userId, input.supabase);
    } catch (error) {
      logStructured("warn", {
        event: "billing.referral.conversion_record_failed",
        requestId: input.requestId,
        route: "lib.billing.trial-email-events",
        durationMs: 0,
        status: "referral_conversion_failed",
        userId,
      });
      captureObservedError(error, {
        event: "billing.referral.conversion_record_failed",
        requestId: input.requestId,
        route: "lib.billing.trial-email-events",
        durationMs: 0,
        status: "referral_conversion_failed",
        userId,
      });
    }

    await dispatchTrialConvertedEmailEvent({
      userId,
      stripeSubscriptionId: subscriptionId,
      convertedAt: new Date().toISOString(),
    });
  } catch (error) {
    logStructured("warn", {
      event: "billing.trial_email.conversion_check_failed",
      requestId: input.requestId,
      route: "lib.billing.trial-email-events",
      durationMs: 0,
      status: "conversion_check_failed",
    });
    captureObservedError(error, {
      event: "billing.trial_email.conversion_check_failed",
      requestId: input.requestId,
      route: "lib.billing.trial-email-events",
      durationMs: 0,
      status: "conversion_check_failed",
    });
  }
}
