import { normalizeError, parseJson } from "@/lib/api-client";
import {
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";
import {
  fetchMeetingGroupOptions,
  type MeetingGroupOption,
} from "@/lib/meeting-groups-client";

interface CurrentUserDefaultsResponse {
  user?: {
    whatsappNumber?: string;
  };
  error?: string;
}

interface UploadInitApiResponse {
  r2Key?: string;
  uploadUrl?: string;
  uploadToken?: string;
  error?: string;
}

interface ProcessMeetingApiResponse {
  meetingId?: string;
  error?: string;
}

export interface MeetingIntakeDefaults {
  accountWhatsappNumber: string;
  meetingGroups: MeetingGroupOption[];
}

export interface InitMeetingUploadInput {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface ProcessMeetingUploadInput {
  meetingDate: string;
  whatsappNumber: string;
  r2Key: string;
  uploadToken?: string;
  groupId?: string | null;
}

export async function fetchMeetingIntakeDefaults(): Promise<MeetingIntakeDefaults> {
  const [response, meetingGroups] = await Promise.all([
    fetch("/api/user/me", { method: "GET" }),
    fetchMeetingGroupOptions(),
  ]);
  const body = await parseJson<CurrentUserDefaultsResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao carregar usuário."));
  }

  const normalized = normalizeWhatsappNumber(body.user.whatsappNumber ?? "");
  return {
    accountWhatsappNumber: isValidWhatsappNumber(normalized) ? normalized : "",
    meetingGroups,
  };
}

export async function initMeetingUpload(
  input: InitMeetingUploadInput
): Promise<{ r2Key: string; uploadUrl: string; uploadToken: string }> {
  const response = await fetch("/api/meetings/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await parseJson<UploadInitApiResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Erro ao preparar upload. Tente novamente.")
    );
  }

  if (!body.r2Key || !body.uploadUrl || !body.uploadToken) {
    throw new Error("Resposta inválida do servidor ao iniciar upload.");
  }

  return {
    r2Key: body.r2Key,
    uploadUrl: body.uploadUrl,
    uploadToken: body.uploadToken,
  };
}

export async function processUploadedMeeting(
  input: ProcessMeetingUploadInput
): Promise<string> {
  const response = await fetch("/api/meetings/process", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      meetingDate: input.meetingDate,
      whatsappNumber: input.whatsappNumber,
      r2Key: input.r2Key,
      ...(input.uploadToken ? { uploadToken: input.uploadToken } : {}),
      ...(input.groupId ? { groupId: input.groupId } : {}),
    }),
  });
  const body = await parseJson<ProcessMeetingApiResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(
        body.error,
        "Houve um erro ao iniciar o processamento desta reunião. Tente processar novamente."
      )
    );
  }

  if (!body.meetingId) {
    throw new Error("Resposta inválida do servidor ao criar reunião.");
  }

  return body.meetingId;
}
