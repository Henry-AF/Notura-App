import { normalizeError, parseJson } from "@/lib/api-client";

export interface MeetingStatusPayload {
  id: string;
  title: string | null;
  status: string;
  taskCount: number;
  decisionCount: number;
}

interface MeetingStatusResponse extends Partial<MeetingStatusPayload> {
  error?: string;
}

export async function fetchMeetingStatus(
  meetingId: string
): Promise<MeetingStatusPayload> {
  const response = await fetch(`/api/meetings/${meetingId}/status`, {
    method: "GET",
  });
  const body = await parseJson<MeetingStatusResponse>(response);

  if (!response.ok || !body.id || typeof body.status !== "string") {
    throw new Error(
      normalizeError(body.error, "Erro ao carregar status da reunião.")
    );
  }

  return {
    id: body.id,
    title: body.title ?? null,
    status: body.status,
    taskCount: body.taskCount ?? 0,
    decisionCount: body.decisionCount ?? 0,
  };
}
