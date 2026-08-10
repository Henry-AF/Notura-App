import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TrialEmailEventColumn =
  | "trial_started_email_event_at"
  | "trial_converted_email_event_at";

export async function hasTrialEmailEventBeenSent(
  userId: string,
  column: TrialEmailEventColumn,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select(column)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read trial email event status: ${error.message}`);
  }

  const row = data as Record<TrialEmailEventColumn, string | null> | null;
  return row?.[column] !== null && row?.[column] !== undefined;
}

/** Marks an event sent only after Resend has confirmed the request. */
export async function markTrialEmailEventSent(
  userId: string,
  column: TrialEmailEventColumn,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .update({ [column]: new Date().toISOString() })
    .eq("user_id", userId)
    .is(column, null)
    .select("user_id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark trial email event as sent: ${error.message}`);
  }

  return Boolean(data);
}
