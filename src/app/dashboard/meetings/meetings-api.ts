import { formatRelativeTime } from "@/lib/utils";
import { normalizeError, parseJson } from "@/lib/api-client";

export type MeetingsPageStatus = "completed" | "processing" | "failed";

interface MeetingsResponseItem {
  id: string;
  clientName: string | null;
  title: string | null;
  createdAt: string;
  status: string;
}

interface MeetingsResponse {
  meetings?: MeetingsResponseItem[];
  error?: string;
}

export interface MeetingsPageMeeting {
  id: string;
  clientName: string;
  title: string;
  date: string;
  rawDate: string;
  status: MeetingsPageStatus;
}

export function normalizeMeetingsStatus(status: string): MeetingsPageStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

export function mapMeetingsResponse(
  response: MeetingsResponse
): MeetingsPageMeeting[] {
  return (response.meetings ?? []).map((meeting) => ({
    id: meeting.id,
    clientName: meeting.clientName ?? meeting.title ?? "—",
    title: meeting.title ?? "—",
    date: formatRelativeTime(meeting.createdAt),
    rawDate: meeting.createdAt,
    status: normalizeMeetingsStatus(meeting.status),
  }));
}

export async function fetchMeetings(): Promise<MeetingsPageMeeting[]> {
  const response = await fetch("/api/meetings", { method: "GET" });
  const body = await parseJson<MeetingsResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar reuniões."));
  }

  return mapMeetingsResponse(body);
}
