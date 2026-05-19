import { normalizeError, parseJson } from "@/lib/api-client";
import type { MeetingEditData } from "./meeting-edit-types";

export interface MeetingEditPayload {
  title: string;
  meetingDate: string;
}

interface MeetingEditResponse {
  id: string;
  title: string | null;
  meetingDate: string | null;
  groupId?: string | null;
  error?: string;
}

function mapMeetingEditResponse(body: MeetingEditResponse): MeetingEditData {
  return {
    id: body.id,
    title: body.title ?? "",
    meetingDate: body.meetingDate ?? "",
    groupId: body.groupId ?? null,
    meetingGroups: [],
  };
}

export async function updateMeetingEditableFields(
  id: string,
  payload: MeetingEditPayload
): Promise<MeetingEditData> {
  const response = await fetch(`/api/meetings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: payload.title,
      meetingDate: payload.meetingDate,
    }),
  });
  const body = await parseJson<MeetingEditResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar reunião."));
  }

  return mapMeetingEditResponse(body);
}
