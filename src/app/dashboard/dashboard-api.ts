import { formatRelativeTime } from "@/lib/utils";
import {
  getDashboardOverview,
  type DashboardOverviewResponse,
} from "@/lib/dashboard/overview";
import type { DashboardOverviewData } from "./dashboard-types";

export function normalizeDashboardMeetingStatus(
  status: string
): DashboardOverviewData["meetings"][number]["status"] {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

export function mapDashboardOverview(
  response: DashboardOverviewResponse
): DashboardOverviewData {
  const meetings = response.recentMeetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title ?? "—",
    date: formatRelativeTime(meeting.createdAt),
    status: normalizeDashboardMeetingStatus(meeting.status),
  }));

  return {
    userName: response.userName,
    plan: response.plan,
    meetingsThisMonth: response.meetingsThisMonth,
    monthlyLimit: response.monthlyLimit,
    meetings,
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
