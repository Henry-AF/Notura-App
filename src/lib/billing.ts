import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingAccount, Plan } from "@/types/database";

const PLAN_LIMITS: Record<Plan, number | null> = {
  free: 3,
  pro: 30,
  team: null,
};

export function getMonthlyMeetingLimit(plan: Plan): number | null {
  return PLAN_LIMITS[plan];
}

export async function getOrCreateBillingAccount(
  userId: string
): Promise<BillingAccount> {
  const supabase = createServiceRoleClient();

  const { data: existing, error } = await supabase
    .from("billing_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing account: ${error.message}`);
  }

  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("billing_accounts")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (insertError || !created) {
    throw new Error(
      `Failed to create billing account: ${insertError?.message ?? "unknown error"}`
    );
  }

  return created;
}

export async function countMeetingsThisMonth(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const { count, error } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);

  if (error) {
    throw new Error(`Failed to count monthly meetings: ${error.message}`);
  }

  return count ?? 0;
}

export async function syncMeetingsThisMonth(
  userId: string,
  meetingsThisMonth: number
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      meetings_this_month: meetingsThisMonth,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to sync billing usage: ${error.message}`);
  }
}

export async function getBillingStatus(userId: string): Promise<{
  billingAccount: BillingAccount;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
}> {
  const billingAccount = await getOrCreateBillingAccount(userId);
  const meetingsThisMonth = await countMeetingsThisMonth(userId);
  const monthlyLimit = getMonthlyMeetingLimit(billingAccount.plan as Plan);

  return {
    billingAccount,
    meetingsThisMonth,
    monthlyLimit,
  };
}
