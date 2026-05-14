import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths } from "date-fns/addMonths";
import { inngest } from "@/lib/inngest";
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
  abacatepaySubscriptionId?: string;
  stripeSubscriptionId?: string;
  previousPeriodEnd?: Date | string | null;
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

export interface AbacatePayAutoRenewStatus {
  autoRenewEnabled: boolean;
  currentPeriodEnd: string | null;
  renewalStatus: string;
}

export interface BillingRenewalContext {
  userId: string;
  plan: Exclude<Plan, "free">;
  currentPeriodEnd: string | null;
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

function parseBillingDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMeetingsUsed(account: Partial<BillingAccount>): number {
  return Math.max(
    0,
    account.meetings_used ?? account.meetings_this_month ?? 0
  );
}

function getQuotaMessage(
  code: MeetingQuotaBlockCode,
  quotaLimit?: number
): string {
  if (code === "subscription_expired") {
    return "Sua assinatura expirou. Renove o plano para processar novas reuniões.";
  }
  if (code === "lifetime_quota_exceeded") {
    return "Você atingiu o limite lifetime do plano Free. Faça upgrade para processar mais reuniões.";
  }
  if (quotaLimit === undefined) {
    return "Você atingiu o limite de reuniões do período atual do seu plano.";
  }
  return `Você atingiu o limite de reuniões do período atual do seu plano (${quotaLimit} reuniões).`;
}

export function resolveQuotaErrorCode(error: {
  code?: string | null;
}): MeetingQuotaBlockCode | null {
  if (error.code === "BP001") return "subscription_expired";
  if (error.code === "BP002") return "lifetime_quota_exceeded";
  if (error.code === "BP003") return "period_quota_exceeded";
  return null;
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

function shouldResetAbacatePayRenewal(params: ResetSubscriptionPeriodParams): boolean {
  return (
    "abacatepayCustomerId" in params ||
    Boolean(params.clearAbacatePayPending) ||
    Boolean(params.abacatepaySubscriptionId)
  );
}

function shouldResetStripeRenewal(params: ResetSubscriptionPeriodParams): boolean {
  return Boolean(params.stripeSubscriptionId);
}

function resolveSubscriptionPeriod(
  params: ResetSubscriptionPeriodParams,
  account: BillingAccount | null,
  now: Date
): { start: Date; end: Date; guardCurrentPeriodEnd: boolean } | null {
  const explicitPreviousPeriodEnd = parseBillingDate(params.previousPeriodEnd);
  if (explicitPreviousPeriodEnd) {
    return {
      start: explicitPreviousPeriodEnd,
      end: addOneMonth(explicitPreviousPeriodEnd),
      guardCurrentPeriodEnd: true,
    };
  }

  const currentPeriodEnd = parseBillingDate(account?.current_period_end);
  if (currentPeriodEnd && currentPeriodEnd.getTime() <= now.getTime()) {
    return {
      start: currentPeriodEnd,
      end: addOneMonth(currentPeriodEnd),
      guardCurrentPeriodEnd: true,
    };
  }

  if (
    account &&
    account.plan !== "free" &&
    currentPeriodEnd &&
    (!params.plan || params.plan === account.plan)
  ) {
    return null;
  }

  return { start: now, end: addOneMonth(now), guardCurrentPeriodEnd: false };
}

function buildSubscriptionResetPayload(
  params: ResetSubscriptionPeriodParams,
  period: { start: Date; end: Date },
  now: Date
): Database["public"]["Tables"]["billing_accounts"]["Update"] {
  const updatePayload: Database["public"]["Tables"]["billing_accounts"]["Update"] = {
    meetings_used: 0,
    current_period_start: period.start.toISOString(),
    current_period_end: period.end.toISOString(),
    updated_at: now.toISOString(),
  };
  if (params.plan) {
    updatePayload.plan = params.plan;
  }
  if ("stripeCustomerId" in params) {
    updatePayload.stripe_customer_id = params.stripeCustomerId;
  }
  if (params.stripeSubscriptionId) {
    updatePayload.stripe_subscription_id = params.stripeSubscriptionId;
  }
  if ("abacatepayCustomerId" in params) {
    updatePayload.abacatepay_customer_id = params.abacatepayCustomerId;
  }
  if (params.abacatepaySubscriptionId) {
    updatePayload.abacatepay_subscription_id = params.abacatepaySubscriptionId;
  }
  return updatePayload;
}

async function scheduleAbacatePayRenewal(
  userId: string | undefined,
  currentPeriodEnd: Date
): Promise<void> {
  if (!userId) return;

  const currentPeriodEndIso = currentPeriodEnd.toISOString();
  await inngest.send({
    id: `renew:${userId}:${currentPeriodEndIso}`,
    name: "billing/abacatepay.renew",
    data: { userId, attempt: 1 },
    ts: currentPeriodEnd.getTime(),
  });
}

export async function getBillingRenewalContext(
  lookup: BillingAccountLookup,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<BillingRenewalContext | null> {
  const account = await getBillingAccountByLookup(lookup, supabase);
  if (!account || account.plan === "free") return null;

  return {
    userId: account.user_id,
    plan: account.plan as Exclude<Plan, "free">,
    currentPeriodEnd: account.current_period_end,
  };
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

  if (insertError) {
    throw new Error(`Failed to create billing account: ${insertError.message}`);
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
  > &
    Partial<
      Pick<
        BillingAccount,
        "abacatepay_auto_renew_enabled" | "abacatepay_renewal_status"
      >
    >,
  now: Date = new Date()
): MeetingQuotaStatus {
  const plan = account.plan as Plan;
  const meetingsUsed = getMeetingsUsed(account);
  const quotaLimit = getMeetingQuotaLimit(plan);
  const hasAbacatePayRetryGrace =
    account.abacatepay_auto_renew_enabled === true &&
    account.abacatepay_renewal_status === "retrying";

  if (
    plan !== "free" &&
    !hasAbacatePayRetryGrace &&
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
    const code = resolveQuotaErrorCode(error);
    if (code) {
      throw new BillingQuotaError(code, getQuotaMessage(code));
    }
    throw new Error(`Failed to consume meeting quota: ${error.message}`);
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

async function loadResetAccount(
  params: ResetSubscriptionPeriodParams,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<BillingAccount | null> {
  return getBillingAccountByLookup(params, supabase);
}

function applyResetPayloadOptions(
  updatePayload: Database["public"]["Tables"]["billing_accounts"]["Update"],
  params: ResetSubscriptionPeriodParams
): void {
  if (params.clearAbacatePayPending) {
    updatePayload.abacatepay_pending_checkout_id = null;
    updatePayload.abacatepay_pending_plan = null;
    updatePayload.abacatepay_renewal_period_end = null;
  }
  if (shouldResetAbacatePayRenewal(params)) {
    updatePayload.abacatepay_auto_renew_enabled = true;
    updatePayload.abacatepay_renewal_attempts = 0;
    updatePayload.abacatepay_renewal_status = "active";
    updatePayload.abacatepay_renewal_period_end = null;
    updatePayload.abacatepay_next_renewal_attempt_at = null;
    updatePayload.abacatepay_last_renewal_error = null;
  }
  if (shouldResetStripeRenewal(params)) {
    updatePayload.stripe_auto_renew_enabled = true;
    updatePayload.stripe_auto_renew_updated_at = new Date().toISOString();
    updatePayload.stripe_renewal_status = "active";
  }
}

export async function resetSubscriptionPeriod(
  params: ResetSubscriptionPeriodParams,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<void> {
  const account = await loadResetAccount(params, supabase);
  if (!params.plan) {
    if (!account || account.plan === "free") return;
  }

  const now = params.now ?? new Date();
  const period = resolveSubscriptionPeriod(params, account, now);
  if (!period) return;

  const updatePayload = buildSubscriptionResetPayload(params, period, now);
  applyResetPayloadOptions(updatePayload, params);
  const query = applyBillingAccountLookup(
    supabase.from("billing_accounts").update(updatePayload),
    params
  );
  const guardedQuery = period.guardCurrentPeriodEnd
    ? query.eq("current_period_end", period.start.toISOString())
    : query;
  const { error } = await guardedQuery;

  if (error) {
    throw new Error(`Failed to reset subscription period: ${error.message}`);
  }

  if (shouldResetAbacatePayRenewal(params)) {
    const userId = "userId" in params ? params.userId : account?.user_id;
    await scheduleAbacatePayRenewal(userId, period.end);
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
    abacatepay_pending_checkout_id: null,
    abacatepay_pending_plan: null,
    abacatepay_renewal_period_end: null,
    updated_at: now.toISOString(),
  });
  const { error } = await applyBillingAccountLookup(query, params);

  if (error) {
    throw new Error(`Failed to downgrade billing account: ${error.message}`);
  }
}

export async function setAbacatePayAutoRenew(
  userId: string,
  enabled: boolean,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<AbacatePayAutoRenewStatus> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_auto_renew_enabled: enabled,
      abacatepay_auto_renew_updated_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .select(
      "abacatepay_auto_renew_enabled, current_period_end, abacatepay_renewal_status"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update AbacatePay auto-renew: ${error.message}`);
  }

  if (!data) {
    throw new Error("Billing account not found.");
  }

  return {
    autoRenewEnabled: data.abacatepay_auto_renew_enabled,
    currentPeriodEnd: data.current_period_end,
    renewalStatus: data.abacatepay_renewal_status,
  };
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
