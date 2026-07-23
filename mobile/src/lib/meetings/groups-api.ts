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
