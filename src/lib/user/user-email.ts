import type { SupabaseClient } from "@supabase/supabase-js";
import { captureObservedError, createTraceId, logStructured } from "@/lib/observability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// `profiles` has no `email` column (see 002_split_profiles_billing.sql), so
// `auth.admin.getUserById` via the service role is the only source of truth.
export async function getUserEmailById(
  userId: string,
  supabase: SupabaseClient<Database> = createServiceRoleClient()
): Promise<string | null> {
  const requestId = createTraceId();

  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;

    return data.user.email ?? null;
  } catch (error) {
    logStructured("warn", {
      event: "user.email.lookup_failed",
      requestId,
      route: "lib.getUserEmailById",
      durationMs: 0,
      status: "email_lookup_failed",
      userId,
    });
    captureObservedError(error, {
      event: "user.email.lookup_failed",
      requestId,
      route: "lib.getUserEmailById",
      durationMs: 0,
      status: "email_lookup_failed",
      userId,
    });
    return null;
  }
}
