import { getBillingStatus } from "@/lib/billing";
import {
  createServerSupabase,
  createServiceRoleClient,
} from "@/lib/supabase/server";
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

function resolveBillingProvider(billingAccount: {
  active_billing_provider?: string | null;
  stripe_subscription_id?: string | null;
}): "stripe" | "abacatepay" {
  if (billingAccount.active_billing_provider === "stripe") return "stripe";
  if (billingAccount.active_billing_provider === "abacatepay") return "abacatepay";
  return billingAccount.stripe_subscription_id ? "stripe" : "abacatepay";
}

function resolveRenewalState(billingAccount: {
  active_billing_provider?: string | null;
  stripe_subscription_id?: string | null;
  stripe_auto_renew_enabled?: boolean | null;
  stripe_renewal_status?: string | null;
  abacatepay_auto_renew_enabled?: boolean | null;
  abacatepay_renewal_status?: string | null;
}) {
  const billingProvider = resolveBillingProvider(billingAccount);
  if (billingProvider === "stripe") {
    return {
      billingProvider,
      autoRenewEnabled: billingAccount.stripe_auto_renew_enabled ?? true,
      renewalStatus: billingAccount.stripe_renewal_status ?? "idle",
    };
  }

  return {
    billingProvider,
    autoRenewEnabled: billingAccount.abacatepay_auto_renew_enabled ?? true,
    renewalStatus: billingAccount.abacatepay_renewal_status ?? "idle",
  };
}

export async function getCurrentUserForIdentity(
  identity: CurrentUserIdentity
): Promise<CurrentUser> {
  const { profile, billingStatus } = await loadCurrentUserData(identity.id);
  const billingAccount = billingStatus.billingAccount;
  const entitlement = billingStatus.entitlement;
  const plan = entitlement.effectivePlan;
  const { billingProvider, autoRenewEnabled, renewalStatus } =
    resolveRenewalState(billingAccount);

  return {
    id: identity.id,
    email: identity.email ?? "",
    name: toUserName(profile?.name, identity.email),
    company: profile?.company ?? "",
    whatsappNumber: profile?.whatsapp_number ?? "",
    plan,
    effectivePlan: entitlement.effectivePlan,
    billingEntitlementStatus: entitlement.status,
    isPaidPlanActive: entitlement.isPaidActive,
    canSendWhatsAppSummary: entitlement.isPaidActive,
    meetingsThisMonth: billingStatus.meetingsThisMonth,
    monthlyLimit: billingStatus.monthlyLimit,
    currentPeriodEnd: billingAccount.current_period_end,
    billingProvider,
    autoRenewEnabled,
    renewalStatus,
    abacatepayAutoRenewEnabled: autoRenewEnabled,
    abacatepayRenewalStatus: renewalStatus,
  };
}

export async function getCurrentUserFromRequest(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabase();
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
