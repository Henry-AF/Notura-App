import { inngest } from "@/lib/inngest";
import {
  createAbacatePaySubscriptionCheckout,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductId,
} from "@/lib/abacatepay";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type { BillingAccount, Plan } from "@/types/database";

const MAX_RENEWAL_ATTEMPTS = 3;
const RETRY_DELAYS_MS: Record<number, number> = {
  1: 24 * 60 * 60 * 1000,
  2: 48 * 60 * 60 * 1000,
};

interface RenewalEventData {
  userId: string;
  attempt?: number;
}

type RenewalBillingAccount = Pick<
  BillingAccount,
  | "user_id"
  | "plan"
  | "current_period_end"
  | "abacatepay_customer_id"
  | "abacatepay_auto_renew_enabled"
  | "abacatepay_renewal_attempts"
  | "abacatepay_renewal_period_end"
  | "abacatepay_pending_checkout_id"
  | "abacatepay_pending_plan"
>;

function resolveInngestRequestId(eventId: unknown): string {
  if (typeof eventId !== "string") return createTraceId();
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : createTraceId();
}

function parseRenewalEventData(payload: unknown): RenewalEventData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid billing/abacatepay.renew payload.");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.userId !== "string" || !record.userId.trim()) {
    throw new Error("billing/abacatepay.renew requires userId.");
  }

  const attempt =
    typeof record.attempt === "number" && Number.isFinite(record.attempt)
      ? Math.max(1, Math.floor(record.attempt))
      : undefined;

  return { userId: record.userId.trim(), attempt };
}

function isPaidPlan(plan: string): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

function buildRenewalUrls(plan: Exclude<Plan, "free">) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl = new URL("/dashboard/settings", baseUrl);
  returnUrl.searchParams.set("payment", "canceled");
  returnUrl.searchParams.set("plan", plan);
  returnUrl.searchParams.set("provider", "abacatepay");

  const completionUrl = new URL("/dashboard/settings", baseUrl);
  completionUrl.searchParams.set("payment", "success");
  completionUrl.searchParams.set("plan", plan);
  completionUrl.searchParams.set("provider", "abacatepay");

  return {
    returnUrl: returnUrl.toString(),
    completionUrl: completionUrl.toString(),
  };
}

async function loadRenewalAccount(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string
): Promise<RenewalBillingAccount | null> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select(
      "user_id, plan, current_period_end, abacatepay_customer_id, abacatepay_auto_renew_enabled, abacatepay_renewal_attempts, abacatepay_renewal_period_end, abacatepay_pending_checkout_id, abacatepay_pending_plan"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing account: ${error.message}`);
  }

  return data;
}

async function markRenewalCheckoutCreated(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  checkoutId: string,
  plan: Exclude<Plan, "free">,
  renewalPeriodEnd: string,
  attempt: number
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_pending_checkout_id: checkoutId,
      abacatepay_pending_plan: plan,
      abacatepay_renewal_period_end: renewalPeriodEnd,
      abacatepay_renewal_attempts: attempt,
      abacatepay_renewal_status: "checkout_created",
      abacatepay_next_renewal_attempt_at: null,
      abacatepay_last_renewal_error: null,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to mark renewal checkout: ${error.message}`);
  }
}

async function markRenewalFailure(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  attempt: number,
  status: "retrying" | "suspended",
  message: string,
  nextAttemptAt: string | null
): Promise<void> {
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_renewal_attempts: attempt,
      abacatepay_renewal_status: status,
      abacatepay_last_renewal_error: message,
      abacatepay_next_renewal_attempt_at: nextAttemptAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to mark renewal failure: ${error.message}`);
  }
}

export const renewAbacatePaySubscription = inngest.createFunction(
  {
    id: "renew-abacatepay-subscription",
    retries: 0,
    triggers: [{ event: "billing/abacatepay.renew" }],
  },
  async ({ event, step }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    const { userId, attempt: eventAttempt } = parseRenewalEventData(event.data);
    const attempt = eventAttempt ?? 1;
    const supabase = createServiceRoleClient();

    const account = await step.run("load-renewal-account", () =>
      loadRenewalAccount(supabase, userId)
    );

    if (!account || !isPaidPlan(account.plan)) {
      return { status: "skipped-no-paid-account" };
    }

    if (!account.abacatepay_auto_renew_enabled) {
      return { status: "skipped-auto-renew-disabled" };
    }

    if (!account.abacatepay_customer_id) {
      return { status: "skipped-missing-abacatepay-customer" };
    }

    if (!account.current_period_end) {
      return { status: "skipped-missing-current-period-end" };
    }

    if (
      account.abacatepay_pending_checkout_id &&
      account.abacatepay_pending_plan === account.plan &&
      account.abacatepay_renewal_period_end === account.current_period_end
    ) {
      return {
        status: "checkout-already-pending",
        checkoutId: account.abacatepay_pending_checkout_id,
      };
    }

    const plan = account.plan;
    const urls = buildRenewalUrls(plan);
    const renewalPeriodEnd = account.current_period_end;

    try {
      const checkout = await step.run("create-renewal-checkout", () =>
        createAbacatePaySubscriptionCheckout({
          productId: getAbacatePayProductId(plan),
          customerId: account.abacatepay_customer_id as string,
          externalId: getAbacatePayCheckoutExternalId(
            userId,
            plan,
            `renewal:${renewalPeriodEnd}`
          ),
          returnUrl: urls.returnUrl,
          completionUrl: urls.completionUrl,
          metadata: {
            userId,
            plan,
            origin: "auto_renewal",
            attempt,
            renewalPeriodEnd,
          },
        })
      );

      await step.run("mark-renewal-checkout-created", () =>
        markRenewalCheckoutCreated(
          supabase,
          userId,
          checkout.id,
          plan,
          renewalPeriodEnd,
          attempt
        )
      );

      logStructured("info", {
        event: "billing.abacatepay.renewal.checkout_created",
        requestId,
        userId,
        route: "inngest/renew-abacatepay-subscription",
        durationMs: Date.now() - startedAt,
        status: 200,
      });

      return { status: "checkout-created" };
    } catch (error) {
      const message = getErrorMessage(error);

      if (attempt >= MAX_RENEWAL_ATTEMPTS) {
        await step.run("mark-renewal-suspended", () =>
          markRenewalFailure(supabase, userId, attempt, "suspended", message, null)
        );
        return { status: "suspended", attempt };
      }

      const retryDelayMs = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[2];
      const nextAttemptAt = new Date(Date.now() + retryDelayMs);
      await step.run("mark-renewal-retrying", () =>
        markRenewalFailure(
          supabase,
          userId,
          attempt,
          "retrying",
          message,
          nextAttemptAt.toISOString()
        )
      );

      await step.sendEvent("schedule-renewal-retry", {
        name: "billing/abacatepay.renew",
        data: { userId, attempt: attempt + 1 },
        ts: nextAttemptAt.getTime(),
      });

      return { status: "retrying", attempt };
    }
  }
);
