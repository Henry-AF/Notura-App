import { TaskType } from "@google/generative-ai";
import { inngest } from "@/lib/inngest";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  answerMeetingQuestionFromChunks,
  generateEmbedding,
} from "@/lib/gemini";
import {
  ensureMeetingChunksIndexed,
  matchMeetingTranscriptChunks,
  toChatSources,
  type ChatSource,
  type MeetingChatFallbackReason,
} from "@/lib/meetings/rag";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type { Json, MeetingChat } from "@/types/database";

interface MeetingChatAnswerEventData {
  chatId: string;
  meetingId: string;
  userId: string;
}

interface ChatMeetingContext {
  chat: Pick<MeetingChat, "id" | "meeting_id" | "user_id" | "question" | "status">;
  meeting: {
    id: string;
    user_id: string;
    transcript: string | null;
    status: string;
  };
}

type SupabaseAdminClient = ReturnType<typeof createServiceRoleClient>;

function resolveInngestRequestId(eventId: unknown): string {
  if (typeof eventId !== "string") return createTraceId();
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : createTraceId();
}

function readRequiredString(
  payload: Record<string, unknown>,
  field: keyof MeetingChatAnswerEventData
): string {
  const value = payload[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid meeting/chat.answer payload: ${field} is required`);
  }
  return value.trim();
}

function parseMeetingChatAnswerEventData(payload: unknown): MeetingChatAnswerEventData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid meeting/chat.answer payload");
  }

  const record = payload as Record<string, unknown>;
  return {
    chatId: readRequiredString(record, "chatId"),
    meetingId: readRequiredString(record, "meetingId"),
    userId: readRequiredString(record, "userId"),
  };
}

async function loadChatMeetingContext(
  supabase: SupabaseAdminClient,
  data: MeetingChatAnswerEventData
): Promise<ChatMeetingContext> {
  const { data: chat, error: chatError } = await supabase
    .from("meeting_chats")
    .select("id, meeting_id, user_id, question, status")
    .eq("id", data.chatId)
    .single();

  if (chatError || !chat || chat.meeting_id !== data.meetingId || chat.user_id !== data.userId) {
    throw new Error("Meeting chat not found for event payload");
  }

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, user_id, transcript, status")
    .eq("id", data.meetingId)
    .single();

  if (meetingError || !meeting || meeting.user_id !== data.userId) {
    throw new Error("Meeting not found for chat answer");
  }

  return { chat, meeting };
}

async function updateChat(
  supabase: SupabaseAdminClient,
  chatId: string,
  payload: Partial<MeetingChat>
): Promise<void> {
  const { error } = await supabase.from("meeting_chats").update(payload).eq("id", chatId);
  if (error) throw new Error(`Failed to update meeting chat: ${error.message}`);
}

async function saveFallback(
  supabase: SupabaseAdminClient,
  chatId: string,
  reason: MeetingChatFallbackReason,
  questionEmbedding: number[] | null,
  sources: ChatSource[] = []
): Promise<void> {
  await updateChat(supabase, chatId, {
    status: "completed",
    answer: "Não encontrei essa informação na transcrição desta reunião.",
    question_embedding: questionEmbedding,
    fallback_reason: reason,
    model_confirmed: false,
    sources: sources as unknown as Json,
    completed_at: new Date().toISOString(),
  });
}

async function saveConfirmedAnswer(
  supabase: SupabaseAdminClient,
  chatId: string,
  answer: string,
  questionEmbedding: number[],
  sources: ChatSource[]
): Promise<void> {
  await updateChat(supabase, chatId, {
    status: "completed",
    answer,
    question_embedding: questionEmbedding,
    fallback_reason: null,
    model_confirmed: true,
    sources: sources as unknown as Json,
    error_message: null,
    completed_at: new Date().toISOString(),
  });
}

async function saveProviderFailure(
  supabase: SupabaseAdminClient,
  chatId: string,
  message: string
): Promise<void> {
  await updateChat(supabase, chatId, {
    status: "failed",
    fallback_reason: "provider_error",
    model_confirmed: false,
    error_message: message,
    completed_at: new Date().toISOString(),
  });
}

function selectCitedSources(
  sources: ChatSource[],
  citedChunkIds: string[]
): ChatSource[] | null {
  const uniqueCitedChunkIds = Array.from(
    new Set(citedChunkIds.map((chunkId) => chunkId.trim()).filter(Boolean))
  );
  if (uniqueCitedChunkIds.length === 0) return null;

  const sourcesByChunkId = new Map(
    sources.map((source) => [source.chunkId, source])
  );
  const citedSources: ChatSource[] = [];

  for (const chunkId of uniqueCitedChunkIds) {
    const source = sourcesByChunkId.get(chunkId);
    if (!source) return null;
    citedSources.push(source);
  }

  return citedSources;
}

export const answerMeetingChat = inngest.createFunction(
  {
    id: "answer-meeting-chat",
    retries: 0,
    triggers: [{ event: "meeting/chat.answer" }],
  },
  async ({ event, step }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    const supabase = createServiceRoleClient();
    const data = parseMeetingChatAnswerEventData(event.data);

    try {
      const { chat, meeting } = await step.run("load-chat-meeting", () =>
        loadChatMeetingContext(supabase, data)
      );

      if (!meeting.transcript) {
        await saveFallback(supabase, chat.id, "no_transcript", null);
        return { chatId: chat.id, status: "completed", fallback: "no_transcript" };
      }

      if (meeting.status !== "completed") {
        await saveFallback(supabase, chat.id, "meeting_not_ready", null);
        return { chatId: chat.id, status: "completed", fallback: "meeting_not_ready" };
      }

      await step.run("ensure-transcript-chunks", () =>
        ensureMeetingChunksIndexed({ supabase, meeting, embedText: generateEmbedding })
      );

      const queryEmbedding = await step.run("embed-question", () =>
        generateEmbedding(chat.question, { taskType: TaskType.RETRIEVAL_QUERY })
      );

      const matches = await step.run("match-transcript-chunks", () =>
        matchMeetingTranscriptChunks({
          supabase,
          userId: chat.user_id,
          meetingId: chat.meeting_id,
          queryEmbedding,
        })
      );

      if (matches.length === 0) {
        await saveFallback(supabase, chat.id, "low_similarity", queryEmbedding);
        return { chatId: chat.id, status: "completed", fallback: "low_similarity" };
      }

      const sources = toChatSources(matches);
      const answer = await step.run("answer-from-chunks", () =>
        answerMeetingQuestionFromChunks({ question: chat.question, chunks: sources })
      );

      if (!answer.isAnsweredFromContext) {
        await saveFallback(
          supabase,
          chat.id,
          "not_confirmed_by_model",
          queryEmbedding,
          sources
        );
        return {
          chatId: chat.id,
          status: "completed",
          fallback: "not_confirmed_by_model",
        };
      }

      const citedSources = selectCitedSources(sources, answer.citedChunkIds);
      if (!citedSources) {
        await saveFallback(
          supabase,
          chat.id,
          "not_confirmed_by_model",
          queryEmbedding,
          sources
        );
        return {
          chatId: chat.id,
          status: "completed",
          fallback: "not_confirmed_by_model",
        };
      }

      await saveConfirmedAnswer(
        supabase,
        chat.id,
        answer.answer,
        queryEmbedding,
        citedSources
      );

      logStructured("info", {
        event: "inngest.job.completed",
        requestId,
        userId: chat.user_id,
        route: "inngest/answer-meeting-chat",
        durationMs: Date.now() - startedAt,
        status: "completed",
      });

      return { chatId: chat.id, status: "completed" };
    } catch (error) {
      const message = getErrorMessage(error);
      await saveProviderFailure(supabase, data.chatId, message);

      captureObservedError(error, {
        event: "inngest.job.failed",
        requestId,
        userId: data.userId,
        route: "inngest/answer-meeting-chat",
        durationMs: Date.now() - startedAt,
        status: "failed",
      });

      return { chatId: data.chatId, status: "failed" };
    }
  }
);
