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
