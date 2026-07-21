import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingEntitlementStatus } from "@/lib/billing";
import { isPlan } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingAccount, Database, Plan } from "@/types/database";

export const ATA_EXPORT_PAID_PLAN_REQUIRED_MESSAGE =
  "Exportar a ata em .docx está disponível apenas para assinantes dos planos Starter e Pro.";

export interface AtaExportAccess {
  canExport: boolean;
  plan: Plan;
}

export class AtaExportPaidPlanRequiredError extends Error {
  readonly status = 403;

  constructor(message = ATA_EXPORT_PAID_PLAN_REQUIRED_MESSAGE) {
    super(message);
    this.name = "AtaExportPaidPlanRequiredError";
  }
}

export async function getAtaExportAccess(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient(),
  now: Date = new Date()
): Promise<AtaExportAccess> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select(
      "plan, current_period_end, abacatepay_auto_renew_enabled, abacatepay_renewal_status"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ATA export access: ${error.message}`);
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
    canExport: entitlement.isPaidActive,
    plan,
  };
}

export async function requireExportPaidPlan(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<AtaExportAccess> {
  const access = await getAtaExportAccess(userId, supabase);

  if (!access.canExport) {
    throw new AtaExportPaidPlanRequiredError();
  }

  return access;
}
