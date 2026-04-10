import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireOwnership,
  type RouteAuthContext,
} from "@/lib/api/auth";
import type { Database, MeetingWithRelations } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;
type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];
type OpenItemRow = Database["public"]["Tables"]["open_items"]["Row"];

interface MeetingRelationsResult {
  tasks: TaskRow[];
  decisions: DecisionRow[];
  openItems: OpenItemRow[];
}

async function fetchMeetingRow(
  supabaseAdmin: SupabaseAdminClient,
  meetingId: string
): Promise<MeetingRow> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (error || !data) {
    throw new Error("Erro ao carregar reunião.");
  }

  return data;
}

async function fetchMeetingRelations(
  supabaseAdmin: SupabaseAdminClient,
  meetingId: string
): Promise<MeetingRelationsResult> {
  const [tasksResult, decisionsResult, openItemsResult] = await Promise.all([
    supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("decisions")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("open_items")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true }),
  ]);

  if (tasksResult.error || decisionsResult.error || openItemsResult.error) {
    throw new Error("Erro ao carregar reunião.");
  }

  return {
    tasks: tasksResult.data ?? [],
    decisions: decisionsResult.data ?? [],
    openItems: openItemsResult.data ?? [],
  };
}

function buildMeetingWithRelations(
  meeting: MeetingRow,
  relations: MeetingRelationsResult
): MeetingWithRelations {
  return {
    ...meeting,
    tasks: relations.tasks,
    decisions: relations.decisions,
    open_items: relations.openItems,
  };
}

export async function getMeetingWithRelationsForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingWithRelations> {
  await requireOwnership(supabaseAdmin, "meetings", meetingId, userId);

  const meeting = await fetchMeetingRow(supabaseAdmin, meetingId);
  const relations = await fetchMeetingRelations(supabaseAdmin, meetingId);

  return buildMeetingWithRelations(meeting, relations);
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
