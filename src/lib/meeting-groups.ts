import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, requireOwnership, type RouteAuthContext } from "@/lib/api/auth";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export interface MeetingGroupListItem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
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

export interface MeetingGroupDashboard {
  group_id: string;
  meetings_count: number;
  minutes_count: number;
  tasks_total: number;
  tasks_pending: number;
  tasks_completed: number;
  decisions_count: number;
  upcoming_meetings_count: number;
}

interface MeetingGroupDashboardMeetingRow {
  id: string;
  status: string;
  meeting_date: string | null;
  summary_whatsapp: string | null;
}

interface MeetingRowsSummary {
  meetings_count: number;
  minutes_count: number;
  upcoming_meetings_count: number;
  meetingIds: string[];
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

async function fetchGroupRows(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  includeArchived: boolean
) {
  let query = supabaseAdmin
    .from("meeting_groups")
    .select("id, name, created_at, updated_at, archived_at")
    .eq("user_id", userId);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

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
  userId: string,
  includeArchived = false
): Promise<MeetingGroupsSnapshot> {
  const [groups, meetings] = await Promise.all([
    fetchGroupRows(supabaseAdmin, userId, includeArchived),
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
  auth: RouteAuthContext,
  includeArchived = false
): Promise<MeetingGroupsSnapshot> {
  return getMeetingGroupsSnapshotForUser(auth.supabaseAdmin, auth.user.id, includeArchived);
}

export async function getOwnedMeetingGroupsSnapshot(
  includeArchived = false
): Promise<MeetingGroupsSnapshot> {
  const auth = await requireAuth();
  return getOwnedMeetingGroupsSnapshotForAuth(auth, includeArchived);
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
    .select("id, name, created_at, updated_at, archived_at")
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
    .select("id, name, created_at, updated_at, archived_at")
    .single();

  if (error || !data) {
    throw new Error("Erro ao atualizar grupo.");
  }

  return { ...data, meetings_count: 0 };
}

export async function setMeetingGroupArchivedForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  groupId: string,
  archived: boolean
): Promise<MeetingGroupListItem> {
  await requireOwnership(supabaseAdmin, "meeting_groups", groupId, userId);
  const { data, error } = await supabaseAdmin
    .from("meeting_groups")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", groupId)
    .select("id, name, created_at, updated_at, archived_at")
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

function summarizeMeetingRows(rows: MeetingGroupDashboardMeetingRow[]): MeetingRowsSummary {
  const now = new Date().toISOString();
  let minutesCount = 0;
  let upcomingCount = 0;

  for (const row of rows) {
    if (row.status === "completed" && row.summary_whatsapp !== null) {
      minutesCount += 1;
    }
    if (row.meeting_date !== null && row.meeting_date >= now) {
      upcomingCount += 1;
    }
  }

  return {
    meetings_count: rows.length,
    minutes_count: minutesCount,
    upcoming_meetings_count: upcomingCount,
    meetingIds: rows.map((row) => row.id),
  };
}

async function fetchDashboardMeetingRows(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  groupId: string
): Promise<MeetingGroupDashboardMeetingRow[]> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, status, meeting_date, summary_whatsapp")
    .eq("user_id", userId)
    .eq("group_id", groupId);

  if (error) {
    throw new Error("Erro ao carregar reunioes do grupo.");
  }

  return data ?? [];
}

async function countTasksAndDecisions(
  supabaseAdmin: SupabaseAdminClient,
  meetingIds: string[]
): Promise<Pick<MeetingGroupDashboard, "tasks_total" | "tasks_pending" | "tasks_completed" | "decisions_count">> {
  if (meetingIds.length === 0) {
    return { tasks_total: 0, tasks_pending: 0, tasks_completed: 0, decisions_count: 0 };
  }

  const [tasksTotal, tasksCompleted, decisionsCount] = await Promise.all([
    supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("meeting_id", meetingIds),
    supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("meeting_id", meetingIds)
      .eq("completed", true),
    supabaseAdmin
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .in("meeting_id", meetingIds),
  ]);

  if (tasksTotal.error || tasksCompleted.error || decisionsCount.error) {
    throw new Error("Erro ao carregar indicadores do grupo.");
  }

  const total = tasksTotal.count ?? 0;
  const completed = tasksCompleted.count ?? 0;

  return {
    tasks_total: total,
    tasks_pending: total - completed,
    tasks_completed: completed,
    decisions_count: decisionsCount.count ?? 0,
  };
}

export async function getMeetingGroupDashboardForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  groupId: string
): Promise<MeetingGroupDashboard> {
  await requireOwnership(supabaseAdmin, "meeting_groups", groupId, userId);

  const rows = await fetchDashboardMeetingRows(supabaseAdmin, userId, groupId);
  const { meetingIds, ...meetingSummary } = summarizeMeetingRows(rows);
  const taskAndDecisionCounts = await countTasksAndDecisions(supabaseAdmin, meetingIds);

  return {
    group_id: groupId,
    ...meetingSummary,
    ...taskAndDecisionCounts,
  };
}

export async function getMeetingGroupDashboardForAuth(
  auth: RouteAuthContext,
  groupId: string
): Promise<MeetingGroupDashboard> {
  return getMeetingGroupDashboardForUser(auth.supabaseAdmin, auth.user.id, groupId);
}
