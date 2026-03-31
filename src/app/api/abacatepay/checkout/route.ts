import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { getOrCreateBillingAccount } from "@/lib/billing";
import {
  createAbacatePayCustomer,
  createAbacatePaySubscriptionCheckout,
  getAbacatePayCustomerPhone,
  getAbacatePayPendingExternalId,
  getAbacatePayProductId,
} from "@/lib/abacatepay";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: Plan;
}

function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const serviceRoleSupabase = createServiceRoleClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json()) as CreateCheckoutBody;
    const plan = body.plan;

    if (!plan || !isPaidPlan(plan)) {
      return NextResponse.json(
        { error: "Plano inválido para checkout." },
        { status: 400 }
      );
    }

    const billingAccount = await getOrCreateBillingAccount(user.id);
    if (billingAccount.plan === plan) {
      return NextResponse.json({
        alreadyActive: true,
        plan,
      });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Seu usuário precisa ter email válido para iniciar o pagamento." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, whatsapp_number")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Não foi possível carregar seu perfil para o checkout." },
        { status: 500 }
      );
    }

    let customerId = billingAccount.abacatepay_customer_id;

    if (!customerId) {
      const customerPhone = getAbacatePayCustomerPhone(
        billingAccount,
        user.phone || profile?.whatsapp_number || null
      );
      const customer = await createAbacatePayCustomer({
        email: user.email,
        name: profile?.name || undefined,
        cellphone: customerPhone,
        metadata: {
          userId: user.id,
          origin: "onboarding",
        },
      });

      customerId = customer.id;
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
      customerId,
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
        { error: "AbacatePay não retornou um checkout válido." },
        { status: 502 }
      );
    }

    const { error: billingUpdateError } = await serviceRoleSupabase
      .from("billing_accounts")
      .update({
        abacatepay_customer_id: customerId,
        abacatepay_pending_checkout_id: subscription.id,
        abacatepay_pending_plan: plan,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (billingUpdateError) {
      return NextResponse.json(
        { error: `Não foi possível salvar o checkout pendente: ${billingUpdateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      checkoutUrl: subscription.url,
    });
  } catch (error) {
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
