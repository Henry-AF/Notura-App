import { formatRelativeTime } from "@/lib/utils";
import { getOwnedMeetings, type MeetingsListItem } from "@/lib/meetings/list";
import type { MeetingsPageMeeting, MeetingsPageStatus } from "./meetings-types";

export function normalizeMeetingsStatus(status: string): MeetingsPageStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

export function mapMeetingsResponse(
  meetings: MeetingsListItem[]
): MeetingsPageMeeting[] {
  return meetings.map((meeting) => ({
    id: meeting.id,
    clientName: meeting.client_name ?? meeting.title ?? "—",
    title: meeting.title ?? "—",
    date: formatRelativeTime(meeting.created_at),
    rawDate: meeting.created_at,
    status: normalizeMeetingsStatus(meeting.status),
  }));
}

export async function fetchMeetings(): Promise<MeetingsPageMeeting[]> {
  const meetings = await getOwnedMeetings();
  return mapMeetingsResponse(meetings);
}
