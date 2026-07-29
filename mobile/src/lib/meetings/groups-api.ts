import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export interface MeetingGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  meetingsCount: number;
}

interface MeetingGroupsApiResponse {
  groups?: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    meetings_count: number;
  }[];
  error?: string;
}

export async function fetchMeetingGroups(): Promise<MeetingGroup[]> {
  const response = await fetchApi("/api/meeting-groups");
  const body = await parseJson<MeetingGroupsApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar grupos."));
  }

  return (body.groups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    meetingsCount: group.meetings_count,
  }));
}

// ─── Full CRUD + group↔meeting linking (NOT-157) ────────────────────────────
// Mirrors `src/lib/meeting-groups-client.ts` on the web.

export type GroupMeetingStatus =
  | "completed"
  | "processing"
  | "failed"
  | "scheduled"
  | "pending";

export interface MeetingGroupItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  meetingsCount: number;
}

export interface GroupMeeting {
  id: string;
  title: string;
  status: GroupMeetingStatus;
  createdAt: string;
  groupId: string | null;
}

export interface GroupsSnapshot {
  groups: MeetingGroupItem[];
  meetings: GroupMeeting[];
}

interface MeetingGroupsSnapshotApiGroup {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  meetings_count: number;
}

interface MeetingGroupsSnapshotApiMeeting {
  id: string;
  title: string | null;
  client_name: string | null;
  status: string;
  created_at: string;
  group_id: string | null;
}

interface MeetingGroupsSnapshotApiResponse {
  groups?: MeetingGroupsSnapshotApiGroup[];
  meetings?: MeetingGroupsSnapshotApiMeeting[];
  error?: string;
}

interface MeetingGroupMutationApiResponse {
  group?: MeetingGroupsSnapshotApiGroup;
  error?: string;
}

function mapGroupItem(group: MeetingGroupsSnapshotApiGroup): MeetingGroupItem {
  return {
    id: group.id,
    name: group.name,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    archivedAt: group.archived_at,
    meetingsCount: group.meetings_count,
  };
}

function normalizeGroupMeetingStatus(status: string): GroupMeetingStatus {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "scheduled") return "scheduled";
  return "pending";
}

function mapGroupMeeting(meeting: MeetingGroupsSnapshotApiMeeting): GroupMeeting {
  return {
    id: meeting.id,
    title: meeting.title ?? meeting.client_name ?? "—",
    status: normalizeGroupMeetingStatus(meeting.status),
    createdAt: meeting.created_at,
    groupId: meeting.group_id,
  };
}

export async function fetchGroupsSnapshot(includeArchived = false): Promise<GroupsSnapshot> {
  const path = includeArchived ? "/api/meeting-groups?include_archived=1" : "/api/meeting-groups";
  const response = await fetchApi(path);
  const body = await parseJson<MeetingGroupsSnapshotApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar grupos."));
  }

  return {
    groups: (body.groups ?? []).map(mapGroupItem),
    meetings: (body.meetings ?? []).map(mapGroupMeeting),
  };
}

export async function createGroup(name: string): Promise<MeetingGroupItem> {
  const response = await fetchApi("/api/meeting-groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const body = await parseJson<MeetingGroupMutationApiResponse>(response);

  if (!response.ok || !body.group) {
    throw new Error(normalizeError(body.error, "Erro ao criar grupo."));
  }

  return mapGroupItem(body.group);
}

export async function renameGroup(groupId: string, name: string): Promise<MeetingGroupItem> {
  const response = await fetchApi(`/api/meeting-groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  const body = await parseJson<MeetingGroupMutationApiResponse>(response);

  if (!response.ok || !body.group) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar grupo."));
  }

  return mapGroupItem(body.group);
}

export async function setGroupArchived(
  groupId: string,
  archived: boolean
): Promise<MeetingGroupItem> {
  const response = await fetchApi(`/api/meeting-groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
  const body = await parseJson<MeetingGroupMutationApiResponse>(response);

  if (!response.ok || !body.group) {
    throw new Error(
      normalizeError(body.error, archived ? "Erro ao arquivar grupo." : "Erro ao desarquivar grupo.")
    );
  }

  return mapGroupItem(body.group);
}

export async function assignMeetingToGroup(
  meetingId: string,
  groupId: string | null
): Promise<void> {
  const response = await fetchApi(`/api/meetings/${meetingId}/group`, {
    method: "PATCH",
    body: JSON.stringify({ groupId }),
  });
  const body = await parseJson<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao mover reunião."));
  }
}
