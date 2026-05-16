import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  createAbacatePaySubscriptionCheckout,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductIdForCheckout,
  isAbacatePayTimeoutError,
} from "@/lib/abacatepay";
import {
  AbacatePayCustomerNotReadyError,
  loadAbacatePayCustomerContext,
} from "@/lib/abacatepay-customer";
import { withBillingSpan } from "@/lib/billing-observability";
import {
  getPlanPrice,
  isBillingCycle,
  isCheckoutPlan,
  resolveInternalPlanForCheckout,
  type BillingCycle,
  type CheckoutPlanType,
} from "@/lib/pricing";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: CheckoutPlanType;
  billingCycle?: BillingCycle;
  price?: number;
  source?: "onboarding" | "settings";
}

type AbacatePayCustomerContext = Awaited<
  ReturnType<typeof loadAbacatePayCustomerContext>
>;

function getCheckoutReturnPath(source: CreateCheckoutBody["source"]): string {
  return source === "settings" ? "/dashboard/settings" : "/onboarding";
}

function resolveCheckoutCustomerId(
  customerContext: AbacatePayCustomerContext
): string {
  if (customerContext.billingAccount.abacatepay_customer_id) {
    return customerContext.billingAccount.abacatepay_customer_id;
  }

  throw new AbacatePayCustomerNotReadyError();
}

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.abacatepayCheckout,
  async (request: NextRequest, { auth }) => {
  let userIdForLog = "anonymous";
  let planForLog: Plan | null = null;

  try {
    const db = createServiceRoleClient();
    const body = (await request.json()) as CreateCheckoutBody;

    userIdForLog = auth.user.id;
    const plan = body.plan;
    const billingCycle = body.billingCycle;
    const source = body.source === "settings" ? "settings" : "onboarding";
    planForLog = plan ?? null;

    if (!plan || !isCheckoutPlan(plan) || !billingCycle || !isBillingCycle(billingCycle)) {
      return NextResponse.json(
        { error: "Plano invalido para checkout." },
        { status: 400 }
      );
    }

    if (typeof body.price === "number" && body.price !== getPlanPrice(plan, billingCycle)) {
      return NextResponse.json(
        { error: "Preco invalido para o plano selecionado." },
        { status: 400 }
      );
    }

    const internalPlan = resolveInternalPlanForCheckout(plan);

    const customerContext = await loadAbacatePayCustomerContext(
      db,
      auth.user.id,
      source
    );
    if (customerContext.billingAccount.plan === internalPlan) {
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
    returnUrl.searchParams.set("billingCycle", billingCycle);
    returnUrl.searchParams.set("provider", "abacatepay");

    const completionUrl = new URL(returnPath, appBaseUrl);
    completionUrl.searchParams.set("payment", "success");
    completionUrl.searchParams.set("plan", plan);
    completionUrl.searchParams.set("billingCycle", billingCycle);
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
          productId: getAbacatePayProductIdForCheckout(plan, billingCycle),
          customerId,
          externalId: getAbacatePayCheckoutExternalId(auth.user.id, internalPlan),
          returnUrl: returnUrl.toString(),
          completionUrl: completionUrl.toString(),
          metadata: {
            userId: auth.user.id,
            plan,
            internalPlan,
            billingCycle,
            price: getPlanPrice(plan, billingCycle),
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
            abacatepay_pending_plan: internalPlan,
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

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[abacatepay-checkout] Failed to create checkout session:", message);

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
