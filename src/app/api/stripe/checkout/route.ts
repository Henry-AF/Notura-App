import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { getOrCreateBillingAccount } from "@/lib/billing";
import { getAppBaseUrl, getStripe, getStripePriceId } from "@/lib/stripe";
import {
  getPlanPrice,
  isBillingCycle,
  isCheckoutPlan,
  resolveInternalPlanForCheckout,
  type BillingCycle,
  type CheckoutPlanType,
} from "@/lib/pricing";

interface CreateCheckoutBody {
  plan?: CheckoutPlanType;
  billingCycle?: BillingCycle;
  price?: number;
  source?: "onboarding" | "settings";
}

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.stripeCheckout,
  async (request: NextRequest, { auth }) => {
  try {
    const body = (await request.json()) as CreateCheckoutBody;
    const plan = body.plan;
    const billingCycle = body.billingCycle;

    if (!plan || !isCheckoutPlan(plan) || !billingCycle || !isBillingCycle(billingCycle)) {
      return NextResponse.json(
        { error: "Plano inválido para checkout." },
        { status: 400 }
      );
    }

    if (typeof body.price === "number" && body.price !== getPlanPrice(plan, billingCycle)) {
      return NextResponse.json(
        { error: "Preço inválido para o plano selecionado." },
        { status: 400 }
      );
    }

    const internalPlan = resolveInternalPlanForCheckout(plan);

    const billingAccount = await getOrCreateBillingAccount(auth.user.id);
    if (billingAccount.plan === internalPlan) {
      return NextResponse.json({
        alreadyActive: true,
        plan,
      });
    }

    if (!billingAccount.stripe_customer_id && !auth.user.email) {
      return NextResponse.json(
        { error: "Seu usuário não possui email válido para iniciar o checkout." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin = new URL(request.url).origin;
    const appBaseUrl = getAppBaseUrl(origin);
    const priceId = getStripePriceId(plan, billingCycle);
    const checkoutPath = body.source === "settings" ? "/dashboard/settings" : "/onboarding";
    const successUrl = new URL(checkoutPath, appBaseUrl);
    successUrl.searchParams.set("payment", "success");
    successUrl.searchParams.set("provider", "stripe");
    successUrl.searchParams.set("plan", plan);
    successUrl.searchParams.set("billingCycle", billingCycle);
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = new URL(checkoutPath, appBaseUrl);
    cancelUrl.searchParams.set("payment", "canceled");
    cancelUrl.searchParams.set("provider", "stripe");
    cancelUrl.searchParams.set("plan", plan);
    cancelUrl.searchParams.set("billingCycle", billingCycle);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      client_reference_id: auth.user.id,
      metadata: {
        user_id: auth.user.id,
        plan,
        internal_plan: internalPlan,
        billing_cycle: billingCycle,
        stripe_price_id: priceId,
      },
      ...(billingAccount.stripe_customer_id
        ? { customer: billingAccount.stripe_customer_id }
        : { customer_email: auth.user.email ?? undefined }),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Não foi possível iniciar o checkout." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[stripe-checkout] Failed to create checkout session:", message);
    return NextResponse.json(
      { error: "Falha ao iniciar pagamento." },
      { status: 500 }
    );
  }
  }
);
