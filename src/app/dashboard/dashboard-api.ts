import type { MetricCardProps, Meeting, Task } from "@/components/dashboard";
import { formatRelativeTime } from "@/lib/utils";
import {
  getDashboardOverview,
  type DashboardOverviewResponse,
} from "@/lib/dashboard/overview";
import type { Plan } from "@/types/database";

export interface DashboardOverviewData {
  userName: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  meetings: Meeting[];
  tasks: Task[];
  metrics: MetricCardProps[];
  todayCount: number;
}

export function normalizeDashboardMeetingStatus(
  status: string
): Meeting["status"] {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

export function mapDashboardOverview(
  response: DashboardOverviewResponse
): DashboardOverviewData {
  const meetings = response.recentMeetings.map((meeting) => ({
    id: meeting.id,
    clientName: meeting.clientName ?? meeting.title ?? "—",
    title: meeting.title ?? "—",
    date: formatRelativeTime(meeting.createdAt),
    status: normalizeDashboardMeetingStatus(meeting.status),
  }));

  const tasks = response.openTasks.map((task) => ({
    id: task.id,
    text: task.text,
    completed: task.completed,
    isNew:
      new Date(task.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000),
  }));

  return {
    userName: response.userName,
    plan: response.plan,
    meetingsThisMonth: response.meetingsThisMonth,
    monthlyLimit: response.monthlyLimit,
    meetings,
    tasks,
    metrics: [
      {
        icon: "🎥",
        iconBg: "rgba(108,92,231,0.15)",
        iconColor: "#A29BFE",
        label: "Reuniões este mês",
        value: response.meetingsThisMonth,
        trend: { direction: "neutral", label: "ESTE MÊS" },
      },
      {
        icon: "✓",
        iconBg: "rgba(255,169,77,0.15)",
        iconColor: "#FFA94D",
        label: "Tarefas abertas",
        value: response.openTaskCount,
        trend: { direction: "neutral", label: "PENDENTE" },
      },
      {
        icon: "⏱",
        iconBg: "rgba(78,203,113,0.15)",
        iconColor: "#4ECB71",
        label: "Horas economizadas",
        value: response.hoursSaved,
        trend: { direction: "up", label: "SALVAS" },
      },
    ],
    todayCount: response.todayCount,
  };
}

export async function fetchDashboardOverview(): Promise<DashboardOverviewData> {
  const overview = await getDashboardOverview();
  return mapDashboardOverview(overview);
}
