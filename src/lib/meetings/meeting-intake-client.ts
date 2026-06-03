import { normalizeError, parseJson } from "@/lib/api-client";
import {
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";
import type { MeetingQuotaBlockCode } from "@/lib/billing";
import {
  fetchMeetingGroupOptions,
  type MeetingGroupOption,
} from "@/lib/meeting-groups-client";

interface CurrentUserDefaultsResponse {
  user?: {
    whatsappNumber?: string;
    canSendWhatsAppSummary?: boolean;
    canProcessMeetings?: boolean;
    meetingQuotaBlockCode?: MeetingQuotaBlockCode | null;
    meetingQuotaLimit?: number;
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
  canSendWhatsAppSummary: boolean;
  canProcessMeetings: boolean;
  meetingQuotaMessage: string;
  meetingGroups: MeetingGroupOption[];
}

export interface MeetingQuotaGate {
  canProcessMeetings: boolean;
  meetingQuotaMessage: string;
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

function getMeetingQuotaMessage(
  code: MeetingQuotaBlockCode | null | undefined
): string {
  if (code === "subscription_expired") {
    return "Sua assinatura expirou. Renove seu plano para processar novas reuniões.";
  }

  if (code === "lifetime_quota_exceeded") {
    return "Você atingiu o limite de reuniões do plano Free. Faça upgrade para processar novas reuniões.";
  }

  if (code === "period_quota_exceeded") {
    return "Você atingiu o limite de reuniões do período atual do seu plano. Faça upgrade ou aguarde a renovação para processar novas reuniões.";
  }

  return "Você não tem quota disponível para processar novas reuniões.";
}

function mapMeetingQuotaGate(
  user: CurrentUserDefaultsResponse["user"]
): MeetingQuotaGate {
  const canProcessMeetings = user?.canProcessMeetings !== false;

  return {
    canProcessMeetings,
    meetingQuotaMessage: canProcessMeetings
      ? ""
      : getMeetingQuotaMessage(user.meetingQuotaBlockCode),
  };
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
  const quotaGate = mapMeetingQuotaGate(body.user);
  return {
    accountWhatsappNumber: isValidWhatsappNumber(normalized) ? normalized : "",
    canSendWhatsAppSummary: Boolean(body.user.canSendWhatsAppSummary),
    ...quotaGate,
    meetingGroups,
  };
}

export async function fetchMeetingQuotaGate(): Promise<MeetingQuotaGate> {
  const response = await fetch("/api/user/me", { method: "GET" });
  const body = await parseJson<CurrentUserDefaultsResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao validar sua quota."));
  }

  return mapMeetingQuotaGate(body.user);
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
