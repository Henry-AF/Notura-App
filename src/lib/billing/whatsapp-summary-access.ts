import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingEntitlementStatus } from "@/lib/billing";
import { isPlan } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingAccount, Database, Plan } from "@/types/database";

export const WHATSAPP_SUMMARY_PAID_PLAN_REQUIRED_MESSAGE =
  "Envio do resumo pelo WhatsApp está disponível apenas para assinantes dos planos Pro e Platinum.";

export interface WhatsAppSummaryAccess {
  canSend: boolean;
  plan: Plan;
}

export class WhatsAppSummaryPaidPlanRequiredError extends Error {
  readonly status = 403;

  constructor(message = WHATSAPP_SUMMARY_PAID_PLAN_REQUIRED_MESSAGE) {
    super(message);
    this.name = "WhatsAppSummaryPaidPlanRequiredError";
  }
}

export async function getWhatsAppSummaryAccess(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient(),
  now: Date = new Date()
): Promise<WhatsAppSummaryAccess> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select(
      "plan, current_period_end, abacatepay_auto_renew_enabled, abacatepay_renewal_status"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load WhatsApp summary access: ${error.message}`);
  }

  const plan = isPlan(data?.plan) ? data.plan : "free";
  const entitlement = getBillingEntitlementStatus(
    {
      plan,
      current_period_end: data?.current_period_end ?? null,
      abacatepay_auto_renew_enabled:
        data?.abacatepay_auto_renew_enabled as BillingAccount["abacatepay_auto_renew_enabled"],
      abacatepay_renewal_status:
        data?.abacatepay_renewal_status as BillingAccount["abacatepay_renewal_status"],
    },
    now
  );

  return {
    canSend: entitlement.isPaidActive,
    plan,
  };
}

export async function requireWhatsAppSummaryPaidPlan(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<WhatsAppSummaryAccess> {
  const access = await getWhatsAppSummaryAccess(userId, supabase);

  if (!access.canSend) {
    throw new WhatsAppSummaryPaidPlanRequiredError();
  }

  return access;
}
