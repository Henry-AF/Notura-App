import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export interface ActiveReferralCode {
  id: string;
  code: string;
}

export async function findActiveReferralCode(
  code: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<ActiveReferralCode | null> {
  const { data } = await supabase
    .from("referral_codes")
    .select("id, code")
    .eq("code", code.toLowerCase())
    .eq("active", true)
    .maybeSingle();

  return data;
}

export async function recordReferralConversion(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<void> {
  await supabase
    .from("referrals")
    .update({ converted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("converted_at", null);
}
