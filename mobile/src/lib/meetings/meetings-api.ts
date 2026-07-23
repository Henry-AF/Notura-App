import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export type MeetingStatus = "pending" | "processing" | "completed" | "failed";

export interface MeetingListItem {
  id: string;
  title: string | null;
  clientName: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  status: MeetingStatus;
}

export interface MeetingsPage {
  meetings: MeetingListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface MeetingsApiMeeting {
  id: string;
  title: string | null;
  clientName: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  status: string;
}

interface MeetingsApiResponse {
  meetings: MeetingsApiMeeting[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
}

export interface FetchMeetingsOptions {
  limit?: number;
  cursor?: string | null;
  groupId?: string | null;
}

function normalizeMeetingStatus(status: string): MeetingStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  return "processing";
}

function mapMeetingListItem(meeting: MeetingsApiMeeting): MeetingListItem {
  return {
    id: meeting.id,
    title: meeting.title,
    clientName: meeting.clientName,
    groupId: meeting.groupId,
    groupName: meeting.groupName,
    createdAt: meeting.createdAt,
    status: normalizeMeetingStatus(meeting.status),
  };
}

export async function fetchMeetings(options: FetchMeetingsOptions = {}): Promise<MeetingsPage> {
  const searchParams = new URLSearchParams();
  if (options.limit) {
    searchParams.set("limit", String(options.limit));
  }
  if (options.cursor) {
    searchParams.set("cursor", options.cursor);
  }
  if (options.groupId) {
    searchParams.set("groupId", options.groupId);
  }

  const query = searchParams.toString();
  const path = query ? `/api/meetings?${query}` : "/api/meetings";

  const response = await fetchApi(path);
  const body = await parseJson<MeetingsApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar reuniões."));
  }

  return {
    meetings: (body.meetings ?? []).map(mapMeetingListItem),
    nextCursor: body.nextCursor ?? null,
    hasMore: body.hasMore ?? false,
  };
}
