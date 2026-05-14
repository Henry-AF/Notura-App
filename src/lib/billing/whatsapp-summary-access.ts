import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaidPlan, isPlan } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database, Plan } from "@/types/database";

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
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<WhatsAppSummaryAccess> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load WhatsApp summary access: ${error.message}`);
  }

  const plan = isPlan(data?.plan) ? data.plan : "free";

  return {
    canSend: isPaidPlan(plan),
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
