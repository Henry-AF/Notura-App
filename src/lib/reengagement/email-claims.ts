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

export async function claimReengagementEmail(
  candidate: ReengagementCandidate,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { error } = await supabase.from("reengagement_log").insert({
    user_id: candidate.userId,
    trigger_type: REENGAGEMENT_TRIGGER,
    variant: REENGAGEMENT_VARIANT,
    last_meeting_at: candidate.lastMeetingAt,
  });
  if (error?.code === "23505") return false;
  if (error) {
    throw new Error(`Failed to claim reengagement email: ${error.message}`);
  }
  return true;
}

export async function releaseReengagementEmailClaim(
  candidate: ReengagementCandidate,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const { error } = await supabase
    .from("reengagement_log")
    .delete()
    .eq("user_id", candidate.userId)
    .eq("trigger_type", REENGAGEMENT_TRIGGER)
    .eq("last_meeting_at", candidate.lastMeetingAt);
  if (error) {
    throw new Error(`Failed to release reengagement email claim: ${error.message}`);
  }
}
