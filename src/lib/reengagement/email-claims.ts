import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const REENGAGEMENT_TRIGGER = "meeting_inactive_48h";
export const REENGAGEMENT_VARIANT = "functional";

export interface ReengagementCandidate {
  userId: string;
  lastMeetingAt: string;
  daysSinceLastMeeting: number;
}

interface CandidateRow {
  user_id: string;
  last_meeting_at: string;
  days_since_last_meeting: number;
}

export async function listReengagementCandidates(
  supabase: SupabaseClient<Database>
): Promise<ReengagementCandidate[]> {
  const { data, error } = await supabase.rpc("get_reengagement_email_candidates");
  if (error) {
    throw new Error(`Failed to list reengagement candidates: ${error.message}`);
  }

  return (data as CandidateRow[]).map((row) => ({
    userId: row.user_id,
    lastMeetingAt: row.last_meeting_at,
    daysSinceLastMeeting: row.days_since_last_meeting,
  }));
}

/** Records the claim only after Resend confirms that it accepted the event. */
export async function markReengagementEmailSent(
  candidate: ReengagementCandidate,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const { error } = await supabase.from("reengagement_log").insert({
    user_id: candidate.userId,
    trigger_type: REENGAGEMENT_TRIGGER,
    variant: REENGAGEMENT_VARIANT,
    last_meeting_at: candidate.lastMeetingAt,
  });
  if (error) {
    throw new Error(`Failed to mark reengagement email as sent: ${error.message}`);
  }
}
