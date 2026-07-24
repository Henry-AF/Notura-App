import { normalizeError, parseJson } from "@/lib/api-client";

export interface GroupDashboardView {
  groupId: string;
  meetingsCount: number;
  minutesCount: number;
  tasksTotal: number;
  tasksPending: number;
  tasksCompleted: number;
  decisionsCount: number;
  upcomingMeetingsCount: number;
}

interface GroupDashboardApiDashboard {
  group_id: string;
  meetings_count: number;
  minutes_count: number;
  tasks_total: number;
  tasks_pending: number;
  tasks_completed: number;
  decisions_count: number;
  upcoming_meetings_count: number;
}

interface GroupDashboardApiResponse {
  dashboard?: GroupDashboardApiDashboard;
  error?: string;
}

export function mapGroupDashboard(
  raw: GroupDashboardApiDashboard
): GroupDashboardView {
  return {
    groupId: raw.group_id,
    meetingsCount: raw.meetings_count,
    minutesCount: raw.minutes_count,
    tasksTotal: raw.tasks_total,
    tasksPending: raw.tasks_pending,
    tasksCompleted: raw.tasks_completed,
    decisionsCount: raw.decisions_count,
    upcomingMeetingsCount: raw.upcoming_meetings_count,
  };
}

export async function fetchGroupDashboard(
  groupId: string
): Promise<GroupDashboardView> {
  const response = await fetch(`/api/meeting-groups/${groupId}/dashboard`, {
    method: "GET",
  });
  const body = await parseJson<GroupDashboardApiResponse>(response);

  if (!response.ok || !body.dashboard) {
    throw new Error(
      normalizeError(body.error, "Erro ao carregar indicadores do grupo.")
    );
  }

  return mapGroupDashboard(body.dashboard);
}
