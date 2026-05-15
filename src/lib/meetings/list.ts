import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, type RouteAuthContext } from "@/lib/api/auth";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export interface MeetingsListItem {
  id: string;
  title: string | null;
  client_name: string | null;
  group_name: string | null;
  status: string;
  created_at: string;
}

async function fetchMeetingsForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingsListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, title, client_name, status, created_at, meeting_groups(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar reuniões.");
  }

  return (data ?? []).map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    client_name: meeting.client_name,
    group_name: (meeting.meeting_groups as { name: string } | null)?.name ?? null,
    status: meeting.status,
    created_at: meeting.created_at,
  }));
}

export async function getMeetingsForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingsListItem[]> {
  return fetchMeetingsForUser(supabaseAdmin, userId);
}

export async function getOwnedMeetingsForAuth(
  auth: RouteAuthContext
): Promise<MeetingsListItem[]> {
  return getMeetingsForUser(auth.supabaseAdmin, auth.user.id);
}

export async function getOwnedMeetings(): Promise<MeetingsListItem[]> {
  const auth = await requireAuth();
  return getOwnedMeetingsForAuth(auth);
}
