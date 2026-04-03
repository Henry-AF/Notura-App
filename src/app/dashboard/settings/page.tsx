import { redirect } from "next/navigation";
import { getBillingStatus } from "@/lib/billing";
import { createServerSupabase } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const [{ data: profile, error: profileError }, billingStatus] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("name, role, company, whatsapp_number")
        .eq("id", user.id)
        .maybeSingle(),
      getBillingStatus(user.id),
    ]);

  if (profileError) {
    throw new Error(`Failed to load settings profile: ${profileError.message}`);
  }

  return (
    <SettingsClient
      initialProfile={{
        name: profile?.name ?? "",
        role: profile?.role ?? null,
        company: profile?.company ?? "",
        whatsappNumber: profile?.whatsapp_number ?? "",
      }}
      initialPlan={{
        plan: billingStatus.billingAccount.plan,
        meetingsThisMonth: billingStatus.meetingsThisMonth,
        monthlyLimit: billingStatus.monthlyLimit,
      }}
    />
  );
}
