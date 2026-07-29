import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export type DashboardMeetingStatus = "completed" | "processing" | "failed";

export interface DashboardMeeting {
  id: string;
  title: string;
  date: string;
  status: DashboardMeetingStatus;
  groupName: string | null;
}

export interface DashboardOverview {
  userName: string;
  todayCount: number;
  recentMeetings: DashboardMeeting[];
}

interface DashboardOverviewApiMeeting {
  id: string;
  title: string | null;
  clientName: string | null;
  createdAt: string;
  status: string;
  groupName: string | null;
}

interface DashboardOverviewApiResponse {
  userName: string;
  todayCount: number;
  recentMeetings: DashboardOverviewApiMeeting[];
  error?: string;
}

function normalizeStatus(status: string): DashboardMeetingStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

// Mirrors `formatDate`/`formatRelativeTime` from the web app's
// `src/lib/utils.ts` (duplicated — no shared module boundary, see
// `src/lib/api-client.ts` for the same convention).
function formatDate(date: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return formatDate(dateStr);
}

function mapMeeting(meeting: DashboardOverviewApiMeeting): DashboardMeeting {
  return {
    id: meeting.id,
    title: meeting.title ?? meeting.clientName ?? "—",
    date: formatRelativeTime(meeting.createdAt),
    status: normalizeStatus(meeting.status),
    groupName: meeting.groupName,
  };
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const response = await fetchApi("/api/dashboard/overview");
  const body = await parseJson<DashboardOverviewApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar o dashboard."));
  }

  return {
    userName: body.userName,
    todayCount: body.todayCount,
    recentMeetings: (body.recentMeetings ?? []).map(mapMeeting),
  };
}

export async function retryDashboardMeeting(id: string): Promise<void> {
  const response = await fetchApi(`/api/meetings/${id}/retry`, { method: "POST" });
  if (!response.ok) {
    throw new Error("Erro ao reprocessar a reunião.");
  }
}
