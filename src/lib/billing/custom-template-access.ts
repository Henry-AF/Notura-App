import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingEntitlementStatus } from "@/lib/billing";
import { isPlan } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingAccount, Database, Plan } from "@/types/database";

export const CUSTOM_TEMPLATE_PRO_REQUIRED_MESSAGE =
  "Modelos de ata personalizados estão disponíveis apenas para assinantes do plano Pro.";

export interface CustomTemplateAccess {
  canUseCustomTemplates: boolean;
  plan: Plan;
}

export class CustomTemplateProRequiredError extends Error {
  readonly status = 403;

  constructor(message = CUSTOM_TEMPLATE_PRO_REQUIRED_MESSAGE) {
    super(message);
    this.name = "CustomTemplateProRequiredError";
  }
}

export async function getCustomTemplateAccess(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient(),
  now: Date = new Date()
): Promise<CustomTemplateAccess> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select(
      "plan, current_period_end, abacatepay_auto_renew_enabled, abacatepay_renewal_status"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load custom template access: ${error.message}`);
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
    canUseCustomTemplates: entitlement.effectivePlan === "team",
    plan,
  };
}

export async function requireCustomTemplateAccess(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<CustomTemplateAccess> {
  const access = await getCustomTemplateAccess(userId, supabase);

  if (!access.canUseCustomTemplates) {
    throw new CustomTemplateProRequiredError();
  }

  return access;
}
