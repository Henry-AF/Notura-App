import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanMonthlyLimit } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingAccount, Database, Plan } from "@/types/database";

export function getMonthlyMeetingLimit(plan: Plan): number | null {
  return getPlanMonthlyLimit(plan);
}

export async function getOrCreateBillingAccount(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<BillingAccount> {
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

export async function syncMeetingsThisMonth(
  userId: string,
  meetingsThisMonth: number,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<void> {
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

export async function incrementMeetingsThisMonth(
  userId: string,
  incrementBy: number = 1
): Promise<number> {
  if (!Number.isFinite(incrementBy) || incrementBy < 1) {
    throw new Error("Billing usage increment must be >= 1.");
  }

  const supabase = createServiceRoleClient();
  const safeIncrement = Math.trunc(incrementBy);

  const { data, error } = await supabase.rpc(
    "increment_billing_meetings_this_month",
    {
      p_user_id: userId,
      p_increment: safeIncrement,
    }
  );

  if (!error && typeof data === "number") {
    return data;
  }

  // Backward compatible fallback while the rpc migration rolls out.
  const account = await getOrCreateBillingAccount(userId, supabase);
  const nextValue = Math.max(
    0,
    (account.meetings_this_month ?? 0) + safeIncrement
  );
  await syncMeetingsThisMonth(userId, nextValue, supabase);
  return nextValue;
}

export async function getBillingStatus(userId: string): Promise<{
  billingAccount: BillingAccount;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
}> {
  const billingAccount = await getOrCreateBillingAccount(userId);
  const meetingsThisMonth = Math.max(0, billingAccount.meetings_this_month ?? 0);
  const monthlyLimit = getMonthlyMeetingLimit(billingAccount.plan as Plan);

  return {
    billingAccount,
    meetingsThisMonth,
    monthlyLimit,
  };
}
