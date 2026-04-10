import { getBillingStatus } from "@/lib/billing";
import {
  createServerSupabase,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

export interface DashboardMeetingResponse {
  id: string;
  clientName: string | null;
  title: string | null;
  createdAt: string;
  status: string;
}

export interface DashboardTaskResponse {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface DashboardOverviewResponse {
  userName: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  recentMeetings: DashboardMeetingResponse[];
  openTasks: DashboardTaskResponse[];
  openTaskCount: number;
  hoursSaved: number;
  todayCount: number;
}

export class DashboardUnauthorizedError extends Error {
  constructor() {
    super("Não autenticado.");
    this.name = "DashboardUnauthorizedError";
  }
}

export class DashboardOverviewLoadError extends Error {
  constructor() {
    super("Erro ao carregar dashboard.");
    this.name = "DashboardOverviewLoadError";
  }
}

type DashboardUser = Awaited<ReturnType<typeof getAuthenticatedUser>>;
type DashboardOverviewQueryResults = Awaited<
  ReturnType<typeof fetchDashboardQueryResults>
>;

interface CompletedMeetingSecondsResult {
  data: number | null;
  error: { code?: string; message?: string } | null;
}

function toUserName(name: string | null | undefined, email: string | null) {
  if (name?.trim()) return name.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Usuário";
  return "Usuário";
}

function getStartOfDayIso(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

async function getAuthenticatedUser() {
  const supabaseAuth = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) {
    throw new DashboardUnauthorizedError();
  }

  return user;
}

function isMissingRpcFunctionError(
  error: CompletedMeetingSecondsResult["error"]
): boolean {
  return error?.code === "42883";
}

async function fetchCompletedMeetingSeconds(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string
): Promise<CompletedMeetingSecondsResult> {
  const rpcResult = await supabase.rpc("get_total_completed_meeting_seconds", {
    p_user_id: userId,
  });

  if (!rpcResult.error) {
    return {
      data: Number(rpcResult.data ?? 0),
      error: null,
    };
  }

  if (!isMissingRpcFunctionError(rpcResult.error)) {
    return {
      data: null,
      error: rpcResult.error,
    };
  }

  const fallbackResult = await supabase
    .from("meetings")
    .select("duration_seconds")
    .eq("user_id", userId)
    .eq("status", "completed");

  if (fallbackResult.error) {
    return {
      data: null,
      error: fallbackResult.error,
    };
  }

  const totalSeconds = (fallbackResult.data ?? []).reduce(
    (sum, meeting) => sum + (meeting.duration_seconds ?? 0),
    0
  );

  return {
    data: totalSeconds,
    error: null,
  };
}

async function fetchDashboardQueryResults(userId: string, startOfDay: string) {
  const supabase = createServiceRoleClient();
  const [
    profileResult,
    billingStatus,
    recentMeetingsResult,
    openTaskCountResult,
    openTasksResult,
    completedMeetingSecondsResult,
    todayMeetingsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
    getBillingStatus(userId),
    supabase
      .from("meetings")
      .select("id, title, client_name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", false),
    supabase
      .from("tasks")
      .select("id, description, completed, created_at")
      .eq("user_id", userId)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(5),
    fetchCompletedMeetingSeconds(supabase, userId),
    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfDay)
      .eq("status", "completed"),
  ]);

  return {
    profileResult,
    billingStatus,
    recentMeetingsResult,
    openTaskCountResult,
    openTasksResult,
    completedMeetingSecondsResult,
    todayMeetingsResult,
  };
}

function assertDashboardQueryResults(results: DashboardOverviewQueryResults) {
  if (
    !results.profileResult.error &&
    !results.recentMeetingsResult.error &&
    !results.openTaskCountResult.error &&
    !results.openTasksResult.error &&
    !results.completedMeetingSecondsResult.error &&
    !results.todayMeetingsResult.error
  ) {
    return;
  }

  console.error("[dashboard/overview] query failure", {
    profileError: results.profileResult.error,
    recentMeetingsError: results.recentMeetingsResult.error,
    openTaskCountError: results.openTaskCountResult.error,
    openTasksError: results.openTasksResult.error,
    completedMeetingSecondsError: results.completedMeetingSecondsResult.error,
    todayMeetingsError: results.todayMeetingsResult.error,
  });

  throw new DashboardOverviewLoadError();
}

function mapDashboardOverview(
  user: DashboardUser,
  results: DashboardOverviewQueryResults
): DashboardOverviewResponse {
  const totalSeconds = Number(results.completedMeetingSecondsResult.data ?? 0);

  return {
    userName: toUserName(results.profileResult.data?.name, user.email ?? null),
    plan: results.billingStatus.billingAccount.plan as Plan,
    meetingsThisMonth: results.billingStatus.meetingsThisMonth,
    monthlyLimit: results.billingStatus.monthlyLimit,
    recentMeetings: (results.recentMeetingsResult.data ?? []).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      clientName: meeting.client_name,
      createdAt: meeting.created_at,
      status: meeting.status,
    })),
    openTasks: (results.openTasksResult.data ?? []).map((task) => ({
      id: task.id,
      text: task.description,
      completed: task.completed,
      createdAt: task.created_at,
    })),
    openTaskCount: results.openTaskCountResult.count ?? 0,
    hoursSaved: Math.round(totalSeconds / 3600 / 2),
    todayCount: results.todayMeetingsResult.count ?? 0,
  };
}

function rethrowDashboardOverviewError(error: unknown): never {
  if (error instanceof DashboardUnauthorizedError) {
    throw error;
  }

  if (error instanceof DashboardOverviewLoadError) {
    throw error;
  }

  console.error("[dashboard/overview] unexpected failure:", error);
  throw new DashboardOverviewLoadError();
}

export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
  const user = await getAuthenticatedUser();
  const startOfDay = getStartOfDayIso(new Date());

  try {
    const queryResults = await fetchDashboardQueryResults(user.id, startOfDay);
    assertDashboardQueryResults(queryResults);
    return mapDashboardOverview(user, queryResults);
  } catch (error) {
    rethrowDashboardOverviewError(error);
  }
}
