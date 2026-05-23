import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireOwnership,
  type RouteAuthContext,
} from "@/lib/api/auth";
import type { Database, MeetingWithRelations } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;
type SupabaseSingleResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

async function fetchMeetingWithRelations(
  supabaseAdmin: SupabaseAdminClient,
  meetingId: string
): Promise<MeetingWithRelations> {
  const result = await supabaseAdmin
    .from("meetings")
    .select("*, tasks(*), decisions(*), open_items(*), meeting_participants(*)")
    .eq("id", meetingId)
    .single();

  return unwrapMeetingResult(result);
}

function sortByCreatedAtAsc<T extends { created_at: string }>(rows: T[]): T[] {
  const sorted = [...rows];
  sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return sorted;
}

function withSortedRelations(meeting: MeetingWithRelations): MeetingWithRelations {
  return {
    ...meeting,
    tasks: sortByCreatedAtAsc(meeting.tasks),
    decisions: sortByCreatedAtAsc(meeting.decisions),
    open_items: sortByCreatedAtAsc(meeting.open_items),
  };
}

function unwrapMeetingResult(
  result: SupabaseSingleResult<MeetingWithRelations>
): MeetingWithRelations {
  if (result.error || result.data === null) {
    throw new Error("Erro ao carregar reunião.");
  }

  return result.data;
}

export async function getMeetingWithRelationsForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingWithRelations> {
  await requireOwnership(supabaseAdmin, "meetings", meetingId, userId);

  const meeting = await fetchMeetingWithRelations(supabaseAdmin, meetingId);
  return withSortedRelations(meeting);
}

export async function getOwnedMeetingWithRelationsForAuth(
  auth: RouteAuthContext,
  meetingId: string
): Promise<MeetingWithRelations> {
  return getMeetingWithRelationsForUser(auth.supabaseAdmin, auth.user.id, meetingId);
}

export async function getOwnedMeetingWithRelations(
  meetingId: string
): Promise<MeetingWithRelations> {
  const auth = await requireAuth();
  return getOwnedMeetingWithRelationsForAuth(auth, meetingId);
}
