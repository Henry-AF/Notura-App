import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, requireOwnership, type RouteAuthContext } from "@/lib/api/auth";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export interface MeetingGroupListItem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  meetings_count: number;
}

export interface MeetingGroupMeeting {
  id: string;
  title: string | null;
  client_name: string | null;
  status: string;
  created_at: string;
  group_id: string | null;
}

export interface MeetingGroupsSnapshot {
  groups: MeetingGroupListItem[];
  meetings: MeetingGroupMeeting[];
}

export class MeetingGroupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeetingGroupValidationError";
  }
}

export function normalizeMeetingGroupName(name: unknown): string {
  if (typeof name !== "string") {
    throw new MeetingGroupValidationError("Nome do grupo e obrigatorio.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new MeetingGroupValidationError("Nome do grupo e obrigatorio.");
  }

  if (trimmed.length > 80) {
    throw new MeetingGroupValidationError("Nome do grupo deve ter ate 80 caracteres.");
  }

  return trimmed;
}

function countMeetingsByGroup(meetings: MeetingGroupMeeting[]) {
  return meetings.reduce<Record<string, number>>((acc, meeting) => {
    if (meeting.group_id) {
      acc[meeting.group_id] = (acc[meeting.group_id] ?? 0) + 1;
    }
    return acc;
  }, {});
}

async function fetchGroupRows(supabaseAdmin: SupabaseAdminClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("meeting_groups")
    .select("id, name, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar grupos.");
  }

  return data ?? [];
}

async function fetchMeetingRows(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingGroupMeeting[]> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, title, client_name, status, created_at, group_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar reunioes.");
  }

  return data ?? [];
}

export async function getMeetingGroupsSnapshotForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingGroupsSnapshot> {
  const [groups, meetings] = await Promise.all([
    fetchGroupRows(supabaseAdmin, userId),
    fetchMeetingRows(supabaseAdmin, userId),
  ]);
  const counts = countMeetingsByGroup(meetings);

  return {
    groups: groups.map((group) => ({
      ...group,
      meetings_count: counts[group.id] ?? 0,
    })),
    meetings,
  };
}

export async function getOwnedMeetingGroupsSnapshotForAuth(
  auth: RouteAuthContext
): Promise<MeetingGroupsSnapshot> {
  return getMeetingGroupsSnapshotForUser(auth.supabaseAdmin, auth.user.id);
}

export async function getOwnedMeetingGroupsSnapshot(): Promise<MeetingGroupsSnapshot> {
  const auth = await requireAuth();
  return getOwnedMeetingGroupsSnapshotForAuth(auth);
}

export async function createMeetingGroupForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  name: unknown
): Promise<MeetingGroupListItem> {
  const normalizedName = normalizeMeetingGroupName(name);
  const { data, error } = await supabaseAdmin
    .from("meeting_groups")
    .insert({ user_id: userId, name: normalizedName })
    .select("id, name, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error("Erro ao criar grupo.");
  }

  return { ...data, meetings_count: 0 };
}

export async function updateMeetingGroupForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  groupId: string,
  name: unknown
): Promise<MeetingGroupListItem> {
  await requireOwnership(supabaseAdmin, "meeting_groups", groupId, userId);
  const normalizedName = normalizeMeetingGroupName(name);
  const { data, error } = await supabaseAdmin
    .from("meeting_groups")
    .update({ name: normalizedName })
    .eq("id", groupId)
    .select("id, name, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error("Erro ao atualizar grupo.");
  }

  return { ...data, meetings_count: 0 };
}

export async function deleteMeetingGroupForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  groupId: string
): Promise<void> {
  await requireOwnership(supabaseAdmin, "meeting_groups", groupId, userId);

  const { error: orphanError } = await supabaseAdmin
    .from("meetings")
    .update({ group_id: null })
    .eq("user_id", userId)
    .eq("group_id", groupId);

  if (orphanError) {
    throw new Error("Erro ao remover reunioes do grupo.");
  }

  const { error } = await supabaseAdmin
    .from("meeting_groups")
    .delete()
    .eq("id", groupId);

  if (error) {
    throw new Error("Erro ao deletar grupo.");
  }
}
