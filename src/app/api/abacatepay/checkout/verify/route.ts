import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import {
  getAbacatePayPendingExternalId,
  getAbacatePaySubscriptionById,
  isAbacatePaySubscriptionPaid,
} from "@/lib/abacatepay";
import { getOrCreateBillingAccount } from "@/lib/billing";
import type { Plan } from "@/types/database";

export async function POST() {
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

    const billingAccount = await getOrCreateBillingAccount(user.id);

    if (!billingAccount.abacatepay_pending_checkout_id) {
      if (billingAccount.plan !== "free") {
        return NextResponse.json({
          success: true,
          plan: billingAccount.plan,
        });
      }

      return NextResponse.json(
        { error: "Nenhum checkout pendente encontrado para este usuário." },
        { status: 409 }
      );
    }

    if (
      !billingAccount.abacatepay_pending_plan ||
      (billingAccount.abacatepay_pending_plan !== "pro" &&
        billingAccount.abacatepay_pending_plan !== "team")
    ) {
      return NextResponse.json(
        { error: "Plano pendente inválido para verificação." },
        { status: 400 }
      );
    }

    const pendingPlan = billingAccount.abacatepay_pending_plan as Exclude<Plan, "free">;
    const subscription = await getAbacatePaySubscriptionById(
      billingAccount.abacatepay_pending_checkout_id
    );

    if (!subscription) {
      return NextResponse.json(
        { error: "Checkout pendente não encontrado no AbacatePay." },
        { status: 404 }
      );
    }

    const expectedExternalId = getAbacatePayPendingExternalId(user.id, pendingPlan);
    if (subscription.externalId !== expectedExternalId) {
      return NextResponse.json(
        { error: "Checkout não pertence ao usuário autenticado." },
        { status: 403 }
      );
    }

    const subscriptionUserId =
      typeof subscription.metadata?.userId === "string"
        ? subscription.metadata.userId
        : null;

    if (subscriptionUserId !== user.id) {
      return NextResponse.json(
        { error: "Metadados do pagamento não pertencem ao usuário autenticado." },
        { status: 403 }
      );
    }

    if (!isAbacatePaySubscriptionPaid(subscription)) {
      return NextResponse.json(
        { error: "Pagamento ainda não foi confirmado pelo AbacatePay." },
        { status: 409 }
      );
    }

    const { error: updateError } = await serviceRoleSupabase
      .from("billing_accounts")
      .update({
        plan: pendingPlan,
        abacatepay_customer_id:
          subscription.customerId ?? billingAccount.abacatepay_customer_id,
        abacatepay_pending_checkout_id: null,
        abacatepay_pending_plan: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Não foi possível atualizar seu plano: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: pendingPlan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[abacatepay-checkout-verify] Failed to verify checkout:", message);
    return NextResponse.json(
      { error: "Falha ao verificar pagamento com AbacatePay." },
      { status: 500 }
    );
  }
}
