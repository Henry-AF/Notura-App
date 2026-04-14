import { normalizeError, parseJson } from "@/lib/api-client";
import {
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";

interface NewPageUserResponse {
  user?: {
    whatsappNumber?: string;
  };
  error?: string;
}

export interface NewMeetingDefaults {
  accountWhatsappNumber: string;
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

export interface InitMeetingUploadInput {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface ProcessMeetingUploadInput {
  clientName: string;
  meetingDate: string;
  whatsappNumber: string;
  r2Key: string;
  uploadToken?: string;
}

export async function fetchNewMeetingDefaults(): Promise<NewMeetingDefaults> {
  const response = await fetch("/api/user/me", { method: "GET" });
  const body = await parseJson<NewPageUserResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao carregar usuário."));
  }

  const normalized = normalizeWhatsappNumber(body.user.whatsappNumber ?? "");
  return {
    accountWhatsappNumber: isValidWhatsappNumber(normalized) ? normalized : "",
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
      clientName: input.clientName,
      meetingDate: input.meetingDate,
      whatsappNumber: input.whatsappNumber,
      r2Key: input.r2Key,
      ...(input.uploadToken ? { uploadToken: input.uploadToken } : {}),
    }),
  });
  const body = await parseJson<ProcessMeetingApiResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Erro ao processar reunião. Tente novamente.")
    );
  }

  if (!body.meetingId) {
    throw new Error("Resposta inválida do servidor ao criar reunião.");
  }

  return body.meetingId;
}
