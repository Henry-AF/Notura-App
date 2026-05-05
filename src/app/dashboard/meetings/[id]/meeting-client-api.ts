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

export async function waitForMeetingChat(
  meetingId: string,
  chatId: string,
  options: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<MeetingChatResponse> {
  const intervalMs = options.intervalMs ?? 1500;
  const maxAttempts = options.maxAttempts ?? 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const chat = await fetchMeetingChat(meetingId, chatId);
    if (chat.status !== "processing") return chat;
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Tempo limite ao aguardar resposta do chat.");
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
