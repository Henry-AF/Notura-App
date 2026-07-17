import { normalizeError, parseJson } from "@/lib/api-client";

export interface MeetingGroupOption {
  id: string;
  name: string;
}

export interface MeetingGroupClientItem extends MeetingGroupOption {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  meetingsCount: number;
}

export interface MeetingGroupClientMeeting {
  id: string;
  title: string;
  status: MeetingGroupStatus;
  createdAt: string;
  groupId: string | null;
}

export interface MeetingGroupsClientSnapshot {
  groups: MeetingGroupClientItem[];
  meetings: MeetingGroupClientMeeting[];
}

interface MeetingGroupsApiGroup {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  meetings_count: number;
}

interface MeetingGroupsApiMeeting {
  id: string;
  title: string | null;
  client_name: string | null;
  status: string;
  created_at: string;
  group_id: string | null;
}

interface MeetingGroupsApiResponse {
  groups?: MeetingGroupsApiGroup[];
  meetings?: MeetingGroupsApiMeeting[];
  error?: string;
}

type MeetingGroupStatus =
  | "completed"
  | "processing"
  | "failed"
  | "scheduled"
  | "pending";

interface MeetingGroupMutationResponse {
  group?: MeetingGroupsApiGroup;
  error?: string;
}

function mapGroup(group: MeetingGroupsApiGroup): MeetingGroupClientItem {
  return {
    id: group.id,
    name: group.name,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    archivedAt: group.archived_at,
    meetingsCount: group.meetings_count,
  };
}

function mapMeetingStatus(status: string): MeetingGroupStatus {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "scheduled") return "scheduled";
  return "pending";
}

function mapMeeting(meeting: MeetingGroupsApiMeeting): MeetingGroupClientMeeting {
  return {
    id: meeting.id,
    title: meeting.title ?? "Reuniao sem titulo",
    status: mapMeetingStatus(meeting.status),
    createdAt: meeting.created_at,
    groupId: meeting.group_id,
  };
}

function mapSnapshot(
  body: MeetingGroupsApiResponse
): MeetingGroupsClientSnapshot {
  return {
    groups: (body.groups ?? []).map(mapGroup),
    meetings: (body.meetings ?? []).map(mapMeeting),
  };
}

export async function fetchMeetingGroupsSnapshot(includeArchived = false) {
  const url = includeArchived
    ? "/api/meeting-groups?include_archived=1"
    : "/api/meeting-groups";
  const response = await fetch(url, { method: "GET" });
  const body = await parseJson<MeetingGroupsApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar grupos."));
  }

  return mapSnapshot(body);
}

export async function fetchMeetingGroupOptions(): Promise<MeetingGroupOption[]> {
  const snapshot = await fetchMeetingGroupsSnapshot();
  return snapshot.groups.map(({ id, name }) => ({ id, name }));
}

export async function createMeetingGroup(
  name: string
): Promise<MeetingGroupClientItem> {
  const response = await fetch("/api/meeting-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await parseJson<MeetingGroupMutationResponse>(response);

  if (!response.ok || !body.group) {
    throw new Error(normalizeError(body.error, "Erro ao criar grupo."));
  }

  return mapGroup(body.group);
}

export async function updateMeetingGroup(
  groupId: string,
  name: string
): Promise<MeetingGroupClientItem> {
  const response = await fetch(`/api/meeting-groups/${groupId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await parseJson<MeetingGroupMutationResponse>(response);

  if (!response.ok || !body.group) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar grupo."));
  }

  return mapGroup(body.group);
}

export async function archiveMeetingGroup(
  groupId: string,
  archived: boolean
): Promise<MeetingGroupClientItem> {
  const response = await fetch(`/api/meeting-groups/${groupId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archived }),
  });
  const body = await parseJson<MeetingGroupMutationResponse>(response);

  if (!response.ok || !body.group) {
    throw new Error(
      normalizeError(
        body.error,
        archived ? "Erro ao arquivar grupo." : "Erro ao desarquivar grupo."
      )
    );
  }

  return mapGroup(body.group);
}

export async function deleteMeetingGroup(groupId: string): Promise<void> {
  const response = await fetch(`/api/meeting-groups/${groupId}`, {
    method: "DELETE",
  });
  const body = await parseJson<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao deletar grupo."));
  }
}

export async function assignMeetingToGroup(
  meetingId: string,
  groupId: string | null
): Promise<void> {
  const response = await fetch(`/api/meetings/${meetingId}/group`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
  const body = await parseJson<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao mover reuniao."));
  }
}
