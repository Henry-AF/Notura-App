import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  createAbacatePaySubscriptionCheckout,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductId,
  isAbacatePayTimeoutError,
} from "@/lib/abacatepay";
import {
  AbacatePayCustomerNotReadyError,
  loadAbacatePayCustomerContext,
} from "@/lib/abacatepay-customer";
import { withBillingSpan } from "@/lib/billing-observability";
import { captureObservedError, createTraceId, getErrorMessage } from "@/lib/observability";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: Plan;
  source?: "onboarding" | "settings";
}

function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

type AbacatePayCustomerContext = Awaited<
  ReturnType<typeof loadAbacatePayCustomerContext>
>;

function getCheckoutReturnPath(source: CreateCheckoutBody["source"]): string {
  return source === "settings" ? "/dashboard" : "/onboarding";
}

function resolveCheckoutCustomerId(
  customerContext: AbacatePayCustomerContext
): string {
  if (customerContext.billingAccount.abacatepay_customer_id) {
    return customerContext.billingAccount.abacatepay_customer_id;
  }

  throw new AbacatePayCustomerNotReadyError();
}

export const POST = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.abacatepayCheckout,
  async (request: NextRequest, { auth }) => {
  const startedAt = Date.now();
  const requestId = createTraceId();
  let userIdForLog = "anonymous";
  let planForLog: Plan | null = null;

  try {
    const db = createServiceRoleClient();
    const body = (await request.json()) as CreateCheckoutBody;

    userIdForLog = auth.user.id;
    const plan = body.plan;
    const source = body.source === "settings" ? "settings" : "onboarding";
    planForLog = plan ?? null;

    if (!plan || !isPaidPlan(plan)) {
      return NextResponse.json(
        { error: "Plano invalido para checkout." },
        { status: 400 }
      );
    }

    const customerContext = await loadAbacatePayCustomerContext(
      db,
      auth.user.id,
      source
    );
    if (customerContext.billingAccount.plan === plan) {
      return NextResponse.json({
        alreadyActive: true,
        plan,
      });
    }

    const hadCustomerIdAtStart = Boolean(
      customerContext.billingAccount.abacatepay_customer_id
    );
    const waitedForFreshLock = false;
    const customerId = resolveCheckoutCustomerId(customerContext);

    const origin = new URL(request.url).origin;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const returnPath = getCheckoutReturnPath(source);
    const returnUrl = new URL(returnPath, appBaseUrl);
    returnUrl.searchParams.set("payment", "canceled");
    returnUrl.searchParams.set("plan", plan);
    returnUrl.searchParams.set("provider", "abacatepay");

    const completionUrl = new URL(returnPath, appBaseUrl);
    completionUrl.searchParams.set("payment", "success");
    completionUrl.searchParams.set("plan", plan);
    completionUrl.searchParams.set("provider", "abacatepay");

    const subscription = await withBillingSpan(
      {
        name: "billing.abacatepay.create_subscription_checkout",
        op: "http.client",
        attributes: {
          "billing.dependency": "abacatepay",
          "billing.flow": source,
          hadCustomerIdAtStart,
          waitedForFreshLock,
        },
      },
      () =>
        createAbacatePaySubscriptionCheckout({
          productId: getAbacatePayProductId(plan),
          customerId,
          externalId: getAbacatePayCheckoutExternalId(auth.user.id, plan),
          returnUrl: returnUrl.toString(),
          completionUrl: completionUrl.toString(),
          metadata: {
            userId: auth.user.id,
            plan,
            origin: source,
          },
        })
    );

    if (!subscription.id || !subscription.url) {
      return NextResponse.json(
        { error: "AbacatePay nao retornou um checkout valido." },
        { status: 502 }
      );
    }

    const { error: billingUpdateError } = await withBillingSpan(
      {
        name: "billing.abacatepay.update_billing_accounts",
        op: "db",
        attributes: {
          "billing.flow": source,
          "billing.operation": "checkout_pending_update",
          hadCustomerIdAtStart,
          waitedForFreshLock,
        },
      },
      () =>
        db
          .from("billing_accounts")
          .update({
            abacatepay_customer_id: customerId,
            abacatepay_pending_checkout_id: subscription.id,
            abacatepay_pending_plan: plan,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", auth.user.id)
    );

    if (billingUpdateError) {
      return NextResponse.json(
        {
          error: `Nao foi possivel salvar o checkout pendente: ${billingUpdateError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      checkoutUrl: subscription.url,
    });
  } catch (error) {
    if (isAbacatePayTimeoutError(error)) {
      console.error(
        `[abacatepay-checkout] checkout timeout user=${userIdForLog} plan=${planForLog ?? "unknown"}`
      );
    }

    if (error instanceof AbacatePayCustomerNotReadyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message = getErrorMessage(error);
    console.error("[abacatepay-checkout] Failed to create checkout session:", message);
    captureObservedError(error, {
      event: "billing.abacatepay.checkout.failed",
      requestId,
      userId: userIdForLog,
      route: "/api/abacatepay/checkout",
      durationMs: Date.now() - startedAt,
      status: 500,
      extra: {
        plan: planForLog,
      },
    });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Falha ao iniciar pagamento com AbacatePay: ${message}`
            : "Falha ao iniciar pagamento com AbacatePay.",
      },
      { status: 500 }
    );
  }
  }
);
