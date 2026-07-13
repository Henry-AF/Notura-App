import { normalizeError, parseJson } from "@/lib/api-client";

// ─── Meeting chat types ───────────────────────────────────────────────────────

export interface CreateMeetingChatResponse {
  chatId: string;
  status: "processing";
}

export interface MeetingChatSource {
  chunkId: string;
  similarity: number;
  startMs: number | null;
  endMs: number | null;
  speaker: string | null;
  text: string;
}

export interface MeetingChatResponse {
  id: string;
  status: "processing" | "completed" | "failed";
  question: string;
  answer: string | null;
  fallbackReason: string | null;
  modelConfirmed: boolean | null;
  sources: MeetingChatSource[];
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MeetingParticipantDisplayResponse {
  id: string;
  displayName: string;
  originalName: string;
  role: "participant" | "entity";
}

export interface MeetingParticipantUpdateResponse {
  participant: MeetingParticipantDisplayResponse;
}

const DEFAULT_CHAT_POLL_INITIAL_INTERVAL_MS = 500;
const DEFAULT_CHAT_POLL_MAX_INTERVAL_MS = 2000;

interface WaitForMeetingChatOptions {
  intervalMs?: number;
  maxIntervalMs?: number;
  maxAttempts?: number;
}

function readErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const { error } = body as { error?: unknown };
  return typeof error === "string" ? error : undefined;
}

// ─── Meeting chat API helpers ─────────────────────────────────────────────────

export async function createMeetingChat(
  meetingId: string,
  question: string
): Promise<CreateMeetingChatResponse> {
  const response = await fetch(`/api/meetings/${meetingId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const body = await parseJson<CreateMeetingChatResponse & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao criar chat."));
  }

  return body;
}

export async function fetchMeetingChat(
  meetingId: string,
  chatId: string
): Promise<MeetingChatResponse> {
  const response = await fetch(`/api/meetings/${meetingId}/chats/${chatId}`);
  const body = await parseJson<MeetingChatResponse & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar chat."));
  }

  return body;
}

export async function fetchMeetingArchivedChats(
  meetingId: string
): Promise<MeetingChatResponse[]> {
  const response = await fetch(`/api/meetings/${meetingId}/chats`);
  const body = await parseJson<unknown>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(readErrorMessage(body), "Erro ao carregar chats da reuniao.")
    );
  }

  if (!Array.isArray(body)) {
    throw new Error("Erro ao carregar chats da reuniao.");
  }

  return body as MeetingChatResponse[];
}

export async function waitForMeetingChat(
  meetingId: string,
  chatId: string,
  options: WaitForMeetingChatOptions = {}
): Promise<MeetingChatResponse> {
  const initialIntervalMs =
    options.intervalMs ?? DEFAULT_CHAT_POLL_INITIAL_INTERVAL_MS;
  const maxIntervalMs =
    options.maxIntervalMs ?? DEFAULT_CHAT_POLL_MAX_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? 120;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const chat = await fetchMeetingChat(meetingId, chatId);
    if (chat.status !== "processing") return chat;
    const delayMs = resolveChatPollDelayMs(
      attempt,
      initialIntervalMs,
      maxIntervalMs
    );
    await new Promise<void>((resolve) =>
      setTimeout(resolve, delayMs)
    );
  }

  // Last read before timing out, to catch late provider failures/completions.
  const lastChat = await fetchMeetingChat(meetingId, chatId);
  if (lastChat.status !== "processing") return lastChat;

  throw new Error("Tempo limite ao aguardar resposta do chat.");
}

function resolveChatPollDelayMs(
  attempt: number,
  initialIntervalMs: number,
  maxIntervalMs: number
): number {
  return Math.min(initialIntervalMs * 2 ** attempt, maxIntervalMs);
}

// ─── Meeting status & retry ───────────────────────────────────────────────────

export interface MeetingStatusResponse {
  id: string;
  status: string;
  taskCount: number;
  decisionCount: number;
}

export async function fetchMeetingStatus(id: string): Promise<MeetingStatusResponse> {
  const response = await fetch(`/api/meetings/${id}/status`);
  const body = await parseJson<MeetingStatusResponse & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao verificar status da reunião."));
  }

  return body;
}

export async function retryMeetingProcessing(id: string): Promise<void> {
  const response = await fetch(`/api/meetings/${id}/retry`, { method: "POST" });
  const body = await parseJson<{ success?: boolean; error?: string }>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao reprocessar reunião."));
  }
}

export async function cancelMeetingProcessing(id: string): Promise<void> {
  const response = await fetch(`/api/meetings/${id}/cancel-processing`, {
    method: "POST",
  });
  const body = await parseJson<{ success?: boolean; error?: string }>(response);

  if (!response.ok || !body.success) {
    throw new Error(
      normalizeError(body.error, "Erro ao cancelar processamento da reunião.")
    );
  }
}

export async function updateMeetingParticipantDisplayName(
  meetingId: string,
  participantId: string,
  displayName: string,
  role?: "participant" | "entity"
) {
  const response = await fetch(`/api/meetings/${meetingId}/participants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      displayName,
      ...(role ? { role } : {}),
    }),
  });
  const body = await parseJson<MeetingParticipantUpdateResponse & { error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Erro ao atualizar participante.")
    );
  }

  return {
    id: body.participant.id,
    name: body.participant.displayName,
    originalName: body.participant.originalName,
    role: body.participant.role,
  };
}

export async function mergeMeetingParticipant(
  meetingId: string,
  participantId: string,
  mergeIntoParticipantId: string
) {
  const response = await fetch(`/api/meetings/${meetingId}/participants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      mergeIntoParticipantId,
    }),
  });
  const body = await parseJson<MeetingParticipantUpdateResponse & { error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Erro ao mesclar participantes.")
    );
  }

  return {
    id: body.participant.id,
    name: body.participant.displayName,
    originalName: body.participant.originalName,
    role: body.participant.role,
  };
}

// ─── Meeting title update ─────────────────────────────────────────────────────

export async function updateMeetingTitle(id: string, title: string): Promise<void> {
  const response = await fetch(`/api/meetings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const body = await parseJson<{ error?: string }>(response);
  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar nome da reunião."));
  }
}

// ─── Meeting delete ───────────────────────────────────────────────────────────

interface MeetingDeleteResponse {
  success?: boolean;
  error?: string;
}

export async function deleteMeetingById(id: string): Promise<void> {
  const response = await fetch(`/api/meetings/${id}`, {
    method: "DELETE",
  });
  const body = await parseJson<MeetingDeleteResponse>(response).catch(
    (): MeetingDeleteResponse => ({})
  );

  if (!response.ok || !body.success) {
    throw new Error(
      normalizeError(body.error, "Erro ao excluir reuniao.")
    );
  }
}

// ─── Meeting ATA export ───────────────────────────────────────────────────────

export interface MeetingTemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
  editable: boolean;
}

export interface MeetingExportResult {
  url: string;
  filename: string;
}

interface MeetingTemplatesResponse {
  templates?: MeetingTemplateOption[];
  error?: string;
}

interface MeetingExportResponse {
  url?: string;
  filename?: string;
  expiresIn?: number;
  error?: string;
}

export async function fetchMeetingTemplates(): Promise<MeetingTemplateOption[]> {
  const response = await fetch("/api/meeting-templates");
  const body = await parseJson<MeetingTemplatesResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar modelos de ata."));
  }

  return body.templates ?? [];
}

export async function exportMeetingAta(
  meetingId: string,
  templateId?: string
): Promise<MeetingExportResult> {
  const response = await fetch(`/api/meetings/${meetingId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(templateId ? { templateId } : {}),
  });
  const body = await parseJson<MeetingExportResponse>(response);

  if (!response.ok || !body.url || !body.filename) {
    throw new Error(normalizeError(body.error, "Erro ao exportar a ata."));
  }

  return { url: body.url, filename: body.filename };
}
