import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, type RouteAuthContext } from "@/lib/api/auth";
import type { Column } from "@/components/tasks";
import type { Database } from "@/types/database";
import { TASK_SELECT, buildTaskColumns, buildTaskMeetingOptions, type TaskMeetingOption } from "./task-mapper";

type SupabaseAdminClient = SupabaseClient<Database>;
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type MeetingOptionRow = { id: string; title: string | null; client_name: string | null };

export interface TaskBoardFilters {
  meetingId?: string;
  groupId?: string;
}

export interface TaskBoardData {
  columns: Column[];
  meetings: TaskMeetingOption[];
}

async function fetchTasksForBoard(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  filters?: TaskBoardFilters
): Promise<TaskRow[]> {
  let query = supabaseAdmin
    .from("tasks")
    .select(TASK_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters?.meetingId) query = query.eq("meeting_id", filters.meetingId);
  if (filters?.groupId) query = query.eq("group_id", filters.groupId);

  const { data, error } = await query;
  if (error) {
    throw new Error("Erro ao buscar tarefas.");
  }

  return data ?? [];
}

async function fetchMeetingsForBoard(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingOptionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, title, client_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao buscar reuniões.");
  }

  return data ?? [];
}

export async function getTaskBoardForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  filters?: TaskBoardFilters
): Promise<TaskBoardData> {
  const [tasks, meetings] = await Promise.all([
    fetchTasksForBoard(supabaseAdmin, userId, filters),
    fetchMeetingsForBoard(supabaseAdmin, userId),
  ]);

  return {
    columns: buildTaskColumns(tasks),
    meetings: buildTaskMeetingOptions(meetings),
  };
}

export async function getOwnedTaskBoardForAuth(
  auth: RouteAuthContext,
  filters?: TaskBoardFilters
): Promise<TaskBoardData> {
  return getTaskBoardForUser(auth.supabaseAdmin, auth.user.id, filters);
}

export async function getOwnedTaskBoard(filters?: TaskBoardFilters): Promise<TaskBoardData> {
  const auth = await requireAuth();
  return getOwnedTaskBoardForAuth(auth, filters);
}
