import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getOrCreateBillingAccount } from "@/lib/billing";
import { getAppBaseUrl, getStripe, getStripePriceId } from "@/lib/stripe";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: Plan;
}

function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

export const POST = withAuth<Record<string, string>, NextRequest>(async (
  request: NextRequest,
  { auth }
) => {
  try {
    const body = (await request.json()) as CreateCheckoutBody;
    const plan = body.plan;

    if (!plan || !isPaidPlan(plan)) {
      return NextResponse.json(
        { error: "Plano inválido para checkout." },
        { status: 400 }
      );
    }

    const billingAccount = await getOrCreateBillingAccount(auth.user.id);
    if (billingAccount.plan === plan) {
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
    const priceId = getStripePriceId(plan);
    const successUrl = new URL("/onboarding", appBaseUrl);
    successUrl.searchParams.set("payment", "success");
    successUrl.searchParams.set("plan", plan);
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = new URL("/onboarding", appBaseUrl);
    cancelUrl.searchParams.set("payment", "canceled");
    cancelUrl.searchParams.set("plan", plan);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      client_reference_id: auth.user.id,
      metadata: {
        user_id: auth.user.id,
        plan,
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
});
