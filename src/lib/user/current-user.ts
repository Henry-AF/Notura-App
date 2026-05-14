import { getBillingStatus } from "@/lib/billing";
import {
  createServerSupabase,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { Plan } from "@/types/database";
import type { CurrentUser, CurrentUserIdentity } from "./current-user-types";

function toUserName(name: string | null | undefined, email: string | null) {
  if (name?.trim()) return name.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Usuário";
  return "Usuário";
}

async function loadCurrentUserData(userId: string) {
  const supabase = createServiceRoleClient();
  const [profileResult, billingStatus] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, company, whatsapp_number")
      .eq("id", userId)
      .maybeSingle(),
    getBillingStatus(userId),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  return {
    profile: profileResult.data,
    billingStatus,
  };
}

export async function getCurrentUserForIdentity(
  identity: CurrentUserIdentity
): Promise<CurrentUser> {
  const { profile, billingStatus } = await loadCurrentUserData(identity.id);
  const billingAccount = billingStatus.billingAccount;
  const usesStripe = Boolean(billingAccount.stripe_subscription_id);
  const autoRenewEnabled = usesStripe
    ? billingAccount.stripe_auto_renew_enabled ?? true
    : billingAccount.abacatepay_auto_renew_enabled ?? true;
  const renewalStatus = usesStripe
    ? billingAccount.stripe_renewal_status ?? "idle"
    : billingAccount.abacatepay_renewal_status ?? "idle";

  return {
    id: identity.id,
    email: identity.email ?? "",
    name: toUserName(profile?.name, identity.email),
    company: profile?.company ?? "",
    whatsappNumber: profile?.whatsapp_number ?? "",
    plan: billingAccount.plan as Plan,
    meetingsThisMonth: billingStatus.meetingsThisMonth,
    monthlyLimit: billingStatus.monthlyLimit,
    currentPeriodEnd: billingAccount.current_period_end ?? null,
    billingProvider: usesStripe ? "stripe" : "abacatepay",
    autoRenewEnabled,
    renewalStatus,
    abacatepayAutoRenewEnabled: autoRenewEnabled,
    abacatepayRenewalStatus: renewalStatus,
  };
}

export async function getCurrentUserFromRequest(): Promise<CurrentUser | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return getCurrentUserForIdentity({
    id: user.id,
    email: user.email ?? null,
  });
}
