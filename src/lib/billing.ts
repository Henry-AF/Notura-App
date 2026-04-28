import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths } from "date-fns/addMonths";
import { getPlanMonthlyLimit } from "@/lib/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BillingAccount, Database, Plan } from "@/types/database";

export type MeetingQuotaBlockCode =
  | "lifetime_quota_exceeded"
  | "period_quota_exceeded"
  | "subscription_expired";

export type MeetingQuotaStatus =
  | {
      allowed: true;
      code: null;
      meetingsUsed: number;
      quotaLimit: number;
    }
  | {
      allowed: false;
      code: MeetingQuotaBlockCode;
      message: string;
      meetingsUsed: number;
      quotaLimit: number;
    };

export class BillingQuotaError extends Error {
  constructor(
    public readonly code: MeetingQuotaBlockCode,
    message: string
  ) {
    super(message);
    this.name = "BillingQuotaError";
  }
}

type BillingAccountLookup =
  | { userId: string }
  | { stripeCustomerId: string }
  | { abacatepayCustomerId: string };

type ResetSubscriptionPeriodParams = BillingAccountLookup & {
  plan?: Exclude<Plan, "free">;
  now?: Date;
  clearAbacatePayPending?: boolean;
};

type DowngradeToFreeParams = BillingAccountLookup & {
  now?: Date;
};

interface ConsumedQuotaRow {
  meetings_used: number;
  plan: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

export function getMonthlyMeetingLimit(plan: Plan): number | null {
  return getPlanMonthlyLimit(plan);
}

function getMeetingQuotaLimit(plan: Plan): number {
  return getPlanMonthlyLimit(plan) ?? 100;
}

function addOneMonth(date: Date): Date {
  return addMonths(date, 1);
}

function getMeetingsUsed(account: Partial<BillingAccount>): number {
  return Math.max(
    0,
    account.meetings_used ?? account.meetings_this_month ?? 0
  );
}

function getQuotaMessage(code: MeetingQuotaBlockCode, quotaLimit: number): string {
  if (code === "subscription_expired") {
    return "Sua assinatura expirou. Renove o plano para processar novas reuniões.";
  }
  if (code === "lifetime_quota_exceeded") {
    return "Você atingiu o limite lifetime do plano Free. Faça upgrade para processar mais reuniões.";
  }
  return `Você atingiu o limite de reuniões do período atual do seu plano (${quotaLimit} reuniões).`;
}

function resolveQuotaErrorCode(message: string): MeetingQuotaBlockCode {
  if (message.includes("subscription_expired")) return "subscription_expired";
  if (message.includes("lifetime_quota_exceeded")) {
    return "lifetime_quota_exceeded";
  }
  return "period_quota_exceeded";
}

function applyBillingAccountLookup<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  lookup: BillingAccountLookup
): T {
  if ("userId" in lookup) return query.eq("user_id", lookup.userId);
  if ("stripeCustomerId" in lookup) {
    return query.eq("stripe_customer_id", lookup.stripeCustomerId);
  }
  return query.eq("abacatepay_customer_id", lookup.abacatepayCustomerId);
}

async function getBillingAccountByLookup(
  lookup: BillingAccountLookup,
  supabase: SupabaseClient<Database>
): Promise<BillingAccount | null> {
  const baseQuery = supabase.from("billing_accounts").select("*");
  const query = applyBillingAccountLookup(baseQuery, lookup);
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing account: ${error.message}`);
  }

  return data;
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

export function getMeetingQuotaStatus(
  account: Pick<
    BillingAccount,
    "plan" | "meetings_used" | "meetings_this_month" | "current_period_end"
  >,
  now: Date = new Date()
): MeetingQuotaStatus {
  const plan = account.plan as Plan;
  const meetingsUsed = getMeetingsUsed(account);
  const quotaLimit = getMeetingQuotaLimit(plan);

  if (
    plan !== "free" &&
    (!account.current_period_end ||
      new Date(account.current_period_end).getTime() <= now.getTime())
  ) {
    return {
      allowed: false,
      code: "subscription_expired",
      message: getQuotaMessage("subscription_expired", quotaLimit),
      meetingsUsed,
      quotaLimit,
    };
  }

  if (meetingsUsed >= quotaLimit) {
    const code =
      plan === "free" ? "lifetime_quota_exceeded" : "period_quota_exceeded";
    return {
      allowed: false,
      code,
      message: getQuotaMessage(code, quotaLimit),
      meetingsUsed,
      quotaLimit,
    };
  }

  return { allowed: true, code: null, meetingsUsed, quotaLimit };
}

export async function consumeMeetingQuota(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<{
  meetingsUsed: number;
  plan: Plan;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}> {
  const { data, error } = await supabase.rpc("consume_meeting_quota", {
    p_user_id: userId,
  });

  if (error) {
    const code = resolveQuotaErrorCode(error.message);
    throw new BillingQuotaError(code, getQuotaMessage(code, getMeetingQuotaLimit("pro")));
  }

  const row = (Array.isArray(data) ? data[0] : data) as ConsumedQuotaRow | null;
  if (!row) throw new Error("Failed to consume meeting quota.");

  return {
    meetingsUsed: row.meetings_used,
    plan: row.plan as Plan,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function refundMeetingQuota(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<void> {
  const { error } = await supabase.rpc("refund_meeting_quota", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to refund billing usage: ${error.message}`);
  }
}

export async function resetSubscriptionPeriod(
  params: ResetSubscriptionPeriodParams,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<void> {
  if (!params.plan) {
    const account = await getBillingAccountByLookup(params, supabase);
    if (!account || account.plan === "free") return;
  }

  const now = params.now ?? new Date();
  const updatePayload: Database["public"]["Tables"]["billing_accounts"]["Update"] = {
    meetings_used: 0,
    current_period_start: now.toISOString(),
    current_period_end: addOneMonth(now).toISOString(),
    updated_at: now.toISOString(),
  };
  if (params.plan) {
    updatePayload.plan = params.plan;
  }
  if ("stripeCustomerId" in params) {
    updatePayload.stripe_customer_id = params.stripeCustomerId;
  }
  if ("abacatepayCustomerId" in params) {
    updatePayload.abacatepay_customer_id = params.abacatepayCustomerId;
  }
  if (params.clearAbacatePayPending) {
    updatePayload.abacatepay_pending_checkout_id = null;
    updatePayload.abacatepay_pending_plan = null;
  }

  const query = supabase.from("billing_accounts").update(updatePayload);
  const { error } = await applyBillingAccountLookup(query, params);

  if (error) {
    throw new Error(`Failed to reset subscription period: ${error.message}`);
  }
}

// Se o usuário fazer o downgrade, ele não recebe a quota do plano free
export async function downgradeToFree(
  params: DowngradeToFreeParams,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<void> {
  const now = params.now ?? new Date();
  const query = supabase.from("billing_accounts").update({
    plan: "free",
    current_period_start: null,
    current_period_end: null,
    updated_at: now.toISOString(),
  });
  const { error } = await applyBillingAccountLookup(query, params);

  if (error) {
    throw new Error(`Failed to downgrade billing account: ${error.message}`);
  }
}

export async function getBillingStatus(userId: string): Promise<{
  billingAccount: BillingAccount;
  meetingsThisMonth: number;
  meetingsUsed: number;
  monthlyLimit: number | null;
  quotaStatus: MeetingQuotaStatus;
}> {
  const billingAccount = await getOrCreateBillingAccount(userId);
  const meetingsUsed = getMeetingsUsed(billingAccount);
  const monthlyLimit = getMonthlyMeetingLimit(billingAccount.plan as Plan);
  const quotaStatus = getMeetingQuotaStatus(billingAccount);

  return {
    billingAccount,
    meetingsThisMonth: meetingsUsed,
    meetingsUsed,
    monthlyLimit,
    quotaStatus,
  };
}
