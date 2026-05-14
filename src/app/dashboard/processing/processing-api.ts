import { normalizeError, parseJson } from "@/lib/api-client";

export interface MeetingStatusPayload {
  id: string;
  title: string | null;
  status: string;
  processingStep: string | null;
  jobStatus: string | null;
  errorMessage: string | null;
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
    processingStep:
      typeof body.processingStep === "string" ? body.processingStep : null,
    jobStatus: typeof body.jobStatus === "string" ? body.jobStatus : null,
    errorMessage:
      typeof body.errorMessage === "string" ? body.errorMessage : null,
    taskCount: body.taskCount ?? 0,
    decisionCount: body.decisionCount ?? 0,
  };
}
