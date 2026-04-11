import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import {
  getAbacatePayPendingExternalId,
  getAbacatePaySubscriptionById,
  isAbacatePaySubscriptionPaid,
  isAbacatePayTimeoutError,
} from "@/lib/abacatepay";
import { getOrCreateBillingAccount } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

export const POST = withAuthRateLimit(
  RATE_LIMIT_POLICIES.abacatepayCheckoutVerify,
  async (_request, { auth }) => {
  let userIdForLog = "anonymous";

  try {
    const db = createServiceRoleClient();
    userIdForLog = auth.user.id;

    const billingAccount = await getOrCreateBillingAccount(auth.user.id, db);

    if (!billingAccount.abacatepay_pending_checkout_id) {
      if (billingAccount.plan !== "free") {
        return NextResponse.json({
          success: true,
          plan: billingAccount.plan,
        });
      }

      return NextResponse.json(
        { error: "Nenhum checkout pendente encontrado para este usuario." },
        { status: 409 }
      );
    }

    if (
      !billingAccount.abacatepay_pending_plan ||
      (billingAccount.abacatepay_pending_plan !== "pro" &&
        billingAccount.abacatepay_pending_plan !== "team")
    ) {
      return NextResponse.json(
        { error: "Plano pendente invalido para verificacao." },
        { status: 400 }
      );
    }

    const pendingPlan = billingAccount.abacatepay_pending_plan as Exclude<Plan, "free">;
    const subscription = await getAbacatePaySubscriptionById(
      billingAccount.abacatepay_pending_checkout_id
    );

    if (!subscription) {
      return NextResponse.json(
        { error: "Checkout pendente nao encontrado no AbacatePay." },
        { status: 404 }
      );
    }

    const expectedExternalId = getAbacatePayPendingExternalId(auth.user.id, pendingPlan);
    if (subscription.externalId !== expectedExternalId) {
      return NextResponse.json(
        { error: "Checkout nao pertence ao usuario autenticado." },
        { status: 403 }
      );
    }

    const subscriptionUserId =
      typeof subscription.metadata?.userId === "string"
        ? subscription.metadata.userId
        : null;

    if (subscriptionUserId !== auth.user.id) {
      return NextResponse.json(
        { error: "Metadados do pagamento nao pertencem ao usuario autenticado." },
        { status: 403 }
      );
    }

    if (!isAbacatePaySubscriptionPaid(subscription)) {
      return NextResponse.json(
        { error: "Pagamento ainda nao foi confirmado pelo AbacatePay." },
        { status: 409 }
      );
    }

    const { error: updateError } = await db
      .from("billing_accounts")
      .update({
        plan: pendingPlan,
        abacatepay_customer_id:
          subscription.customerId ?? billingAccount.abacatepay_customer_id,
        abacatepay_pending_checkout_id: null,
        abacatepay_pending_plan: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Nao foi possivel atualizar seu plano: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: pendingPlan,
    });
  } catch (error) {
    if (isAbacatePayTimeoutError(error)) {
      console.error(`[abacatepay-checkout-verify] verify timeout user=${userIdForLog}`);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[abacatepay-checkout-verify] Failed to verify checkout:", message);

    return NextResponse.json(
      { error: "Falha ao verificar pagamento com AbacatePay." },
      { status: 500 }
    );
  }
  }
);
