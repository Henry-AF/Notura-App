import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  createAbacatePaySubscriptionCheckout,
  getAbacatePayPendingExternalId,
  getAbacatePayProductId,
  isAbacatePayTimeoutError,
} from "@/lib/abacatepay";
import {
  AbacatePayCustomerNotReadyError,
  ensureAbacatePayCustomer,
  loadAbacatePayCustomerContext,
} from "@/lib/abacatepay-customer";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: Plan;
}

function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

export async function POST(request: NextRequest) {
  let userIdForLog = "anonymous";
  let planForLog: Plan | null = null;

  try {
    const supabase = createServerSupabase();
    const [authResult, body] = await Promise.all([
      supabase.auth.getUser(),
      request.json() as Promise<CreateCheckoutBody>,
    ]);
    const {
      data: { user },
      error: authError,
    } = authResult;

    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    userIdForLog = user.id;
    const plan = body.plan;
    planForLog = plan ?? null;

    if (!plan || !isPaidPlan(plan)) {
      return NextResponse.json(
        { error: "Plano invalido para checkout." },
        { status: 400 }
      );
    }

    const customerContext = await loadAbacatePayCustomerContext(supabase, user.id);
    if (customerContext.billingAccount.plan === plan) {
      return NextResponse.json({
        alreadyActive: true,
        plan,
      });
    }

    const ensuredCustomer = await ensureAbacatePayCustomer(
      supabase,
      {
        id: user.id,
        email: user.email ?? null,
      },
      customerContext,
      {
        waitForFreshLock: true,
      }
    );

    if (!ensuredCustomer.customerId) {
      throw new AbacatePayCustomerNotReadyError();
    }

    const origin = new URL(request.url).origin;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const returnUrl = new URL("/onboarding", appBaseUrl);
    returnUrl.searchParams.set("payment", "canceled");
    returnUrl.searchParams.set("plan", plan);

    const completionUrl = new URL("/onboarding", appBaseUrl);
    completionUrl.searchParams.set("payment", "success");
    completionUrl.searchParams.set("plan", plan);

    const subscription = await createAbacatePaySubscriptionCheckout({
      productId: getAbacatePayProductId(plan),
      customerId: ensuredCustomer.customerId,
      externalId: getAbacatePayPendingExternalId(user.id, plan),
      returnUrl: returnUrl.toString(),
      completionUrl: completionUrl.toString(),
      metadata: {
        userId: user.id,
        plan,
        origin: "onboarding",
      },
    });

    if (!subscription.id || !subscription.url) {
      return NextResponse.json(
        { error: "AbacatePay nao retornou um checkout valido." },
        { status: 502 }
      );
    }

    const { error: billingUpdateError } = await supabase
      .from("billing_accounts")
      .update({
        abacatepay_customer_id: ensuredCustomer.customerId,
        abacatepay_pending_checkout_id: subscription.id,
        abacatepay_pending_plan: plan,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

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

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[abacatepay-checkout] Failed to create checkout session:", message);

    if (error instanceof AbacatePayCustomerNotReadyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

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
