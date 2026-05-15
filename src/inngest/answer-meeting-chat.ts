import { TaskType } from "@google/generative-ai";
import { inngest } from "@/lib/inngest";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  answerMeetingQuestionFromChunks,
  GEMINI_TEXT_MODEL_NAME,
  generateEmbedding,
} from "@/lib/gemini";
import {
  buildMeetingChatAiMetric,
  insertMeetingChatAiMetric,
  updateMeetingChatAiMetric,
} from "@/lib/ai/meeting-chat-metrics";
import { refundMeetingChatAiQuota } from "@/lib/ai/usage-limits";
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
type MeetingChatAiMetricPayload = ReturnType<typeof buildMeetingChatAiMetric>;

interface MeetingChatAiMetricState {
  question: string;
  sources: ChatSource[];
  answerModel: string;
  answerText: string | null;
  questionEmbeddingGenerated: boolean;
  generationAttempted: boolean;
  embeddingDurationMs: number | null;
  retrievalDurationMs: number | null;
  generationDurationMs: number | null;
}

interface RecordMeetingChatAiMetricInput {
  supabase: SupabaseAdminClient;
  requestId: string;
  startedAt: number;
  metricId: string | null;
  stage: string;
  errorMessage?: string | null;
  chatId: string;
  meetingId: string;
  userId: string;
  status: "completed" | "failed";
  fallbackReason: MeetingChatFallbackReason | null;
  state: MeetingChatAiMetricState;
}

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

function toUserFacingProviderErrorMessage(rawMessage: string): string {
  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes("503") ||
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable")
  ) {
    return "O serviço de IA está indisponível no momento (503). Tente novamente em instantes.";
  }

  return rawMessage;
}

function createMetricState(): MeetingChatAiMetricState {
  return {
    question: "",
    sources: [],
    answerModel: GEMINI_TEXT_MODEL_NAME,
    answerText: null,
    questionEmbeddingGenerated: false,
    generationAttempted: false,
    embeddingDurationMs: null,
    retrievalDurationMs: null,
    generationDurationMs: null,
  };
}

async function measureDuration<T>(
  setDurationMs: (durationMs: number) => void,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    setDurationMs(Date.now() - startedAt);
  }
}

async function recordMeetingChatAiMetric({
  supabase,
  requestId,
  startedAt,
  metricId,
  stage,
  errorMessage = null,
  chatId,
  meetingId,
  userId,
  status,
  fallbackReason,
  state,
}: RecordMeetingChatAiMetricInput): Promise<void> {
  try {
    const metric = buildMeetingChatAiMetric({
      chatId,
      meetingId,
      userId,
      requestId,
      stage,
      answerModel: state.answerModel,
      errorMessage,
      question: state.question,
      status,
      fallbackReason,
      sources: state.sources,
      answerText: state.answerText,
      questionEmbeddingGenerated: state.questionEmbeddingGenerated,
      generationAttempted: state.generationAttempted,
      embeddingDurationMs: state.embeddingDurationMs,
      retrievalDurationMs: state.retrievalDurationMs,
      generationDurationMs: state.generationDurationMs,
      totalDurationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
    });

    logMeetingChatAiMetric(requestId, metric);
    if (metricId) {
      await updateMeetingChatAiMetric(supabase, metricId, metric);
    } else {
      await insertMeetingChatAiMetric(supabase, metric);
    }
  } catch (error) {
    logStructured("error", {
      event: "meeting.chat.ai_metrics.persist_failed",
      requestId,
      userId,
      route: "inngest/answer-meeting-chat",
      durationMs: Date.now() - startedAt,
      status: "metrics_failed",
      errorMessage: getErrorMessage(error),
    });
    captureObservedError(error, {
      event: "meeting.chat.ai_metrics.persist_failed",
      requestId,
      userId,
      route: "inngest/answer-meeting-chat",
      durationMs: Date.now() - startedAt,
      status: "metrics_failed",
      extra: {
        chatId,
        meetingId,
        metricId,
        stage,
      },
    });
  }
}

async function startMeetingChatAiMetric({
  supabase,
  requestId,
  startedAt,
  chat,
}: {
  supabase: SupabaseAdminClient;
  requestId: string;
  startedAt: number;
  chat: ChatMeetingContext["chat"];
}): Promise<string> {
  const startedAtIso = new Date(startedAt).toISOString();
  const metric = buildMeetingChatAiMetric({
    chatId: chat.id,
    meetingId: chat.meeting_id,
    userId: chat.user_id,
    requestId,
    stage: "answer_started",
    answerModel: GEMINI_TEXT_MODEL_NAME,
    errorMessage: null,
    question: chat.question,
    status: "processing",
    fallbackReason: null,
    sources: [],
    answerText: null,
    questionEmbeddingGenerated: false,
    generationAttempted: false,
    embeddingDurationMs: null,
    retrievalDurationMs: null,
    generationDurationMs: null,
    totalDurationMs: 0,
    startedAt: startedAtIso,
    completedAt: null,
  });

  return insertMeetingChatAiMetric(supabase, metric);
}

function logMeetingChatAiMetric(
  requestId: string,
  metric: MeetingChatAiMetricPayload
): void {
  const level = resolveMetricLogLevel(metric);
  logStructured(level, {
    event: resolveMetricEvent(metric),
    requestId,
    userId: metric.user_id,
    route: "inngest/answer-meeting-chat",
    durationMs: metric.total_duration_ms,
    status: metric.status,
    chatId: metric.chat_id,
    meetingId: metric.meeting_id,
    fallbackReason: metric.fallback_reason,
    embeddingModel: metric.embedding_model,
    answerModel: metric.answer_model,
    retrievedChunksCount: metric.retrieved_chunks_count ?? 0,
    maxSimilarity: metric.max_similarity ?? null,
    avgSimilarity: metric.avg_similarity ?? null,
    questionTokensEstimated: metric.question_tokens_estimated ?? 0,
    contextTokensEstimated: metric.context_tokens_estimated ?? 0,
    answerTokensEstimated: metric.answer_tokens_estimated ?? 0,
    embeddingDurationMs: metric.embedding_duration_ms ?? null,
    retrievalDurationMs: metric.retrieval_duration_ms ?? null,
    generationDurationMs: metric.generation_duration_ms ?? null,
    estimatedCostUsd: metric.estimated_cost_usd ?? 0,
  });
}

function resolveMetricLogLevel(
  metric: MeetingChatAiMetricPayload
): "info" | "warn" | "error" {
  if (metric.status === "failed") return "error";
  return metric.fallback_reason ? "warn" : "info";
}

function resolveMetricEvent(metric: MeetingChatAiMetricPayload): string {
  if (metric.status === "failed") return "meeting.chat.answer.failed";
  if (metric.fallback_reason) return "meeting.chat.answer.fallback";
  return "meeting.chat.answer.completed";
}

async function refundProviderErrorQuota({
  supabase,
  requestId,
  startedAt,
  userId,
  chatId,
}: {
  supabase: SupabaseAdminClient;
  requestId: string;
  startedAt: number;
  userId: string;
  chatId: string;
}): Promise<void> {
  try {
    await refundMeetingChatAiQuota(supabase, {
      userId,
      chatId,
      reason: "provider_error",
    });
  } catch (error) {
    logStructured("warn", {
      event: "meeting.chat.ai_quota_refund_failed",
      requestId,
      userId,
      route: "inngest/answer-meeting-chat",
      durationMs: Date.now() - startedAt,
      status: "refund_failed",
      errorMessage: getErrorMessage(error),
    });
  }
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
    const metricState = createMetricState();
    let metricId: string | null = null;

    try {
      const { chat, meeting } = await step.run("load-chat-meeting", () =>
        loadChatMeetingContext(supabase, data)
      );
      metricState.question = chat.question;

      if (chat.status !== "processing") {
        logStructured("info", {
          event: "meeting.chat.answer.skipped",
          requestId,
          userId: chat.user_id,
          route: "inngest/answer-meeting-chat",
          durationMs: Date.now() - startedAt,
          status: chat.status,
          chatId: chat.id,
          meetingId: chat.meeting_id,
        });
        return { chatId: chat.id, status: chat.status, skipped: true };
      }

      metricId = await step.run("start-ai-metric", () =>
        startMeetingChatAiMetric({ supabase, requestId, startedAt, chat })
      );

      if (!meeting.transcript) {
        await saveFallback(supabase, chat.id, "no_transcript", null);
        await recordMeetingChatAiMetric({
          supabase,
          requestId,
          startedAt,
          metricId,
          stage: "no_transcript",
          chatId: chat.id,
          meetingId: chat.meeting_id,
          userId: chat.user_id,
          status: "completed",
          fallbackReason: "no_transcript",
          state: metricState,
        });
        return { chatId: chat.id, status: "completed", fallback: "no_transcript" };
      }

      if (meeting.status !== "completed") {
        await saveFallback(supabase, chat.id, "meeting_not_ready", null);
        await recordMeetingChatAiMetric({
          supabase,
          requestId,
          startedAt,
          metricId,
          stage: "meeting_not_ready",
          chatId: chat.id,
          meetingId: chat.meeting_id,
          userId: chat.user_id,
          status: "completed",
          fallbackReason: "meeting_not_ready",
          state: metricState,
        });
        return { chatId: chat.id, status: "completed", fallback: "meeting_not_ready" };
      }

      await step.run("ensure-transcript-chunks", () =>
        ensureMeetingChunksIndexed({ supabase, meeting, embedText: generateEmbedding })
      );

      const queryEmbedding = await measureDuration(
        (durationMs) => {
          metricState.embeddingDurationMs = durationMs;
        },
        () =>
          step.run("embed-question", () =>
            generateEmbedding(chat.question, { taskType: TaskType.RETRIEVAL_QUERY })
          )
      );
      metricState.questionEmbeddingGenerated = true;

      const matches = await measureDuration(
        (durationMs) => {
          metricState.retrievalDurationMs = durationMs;
        },
        () =>
          step.run("match-transcript-chunks", () =>
            matchMeetingTranscriptChunks({
              supabase,
              userId: chat.user_id,
              meetingId: chat.meeting_id,
              queryEmbedding,
            })
          )
      );
      metricState.sources = toChatSources(matches);

      if (matches.length === 0) {
        await saveFallback(supabase, chat.id, "low_similarity", queryEmbedding);
        await recordMeetingChatAiMetric({
          supabase,
          requestId,
          startedAt,
          metricId,
          stage: "low_similarity",
          chatId: chat.id,
          meetingId: chat.meeting_id,
          userId: chat.user_id,
          status: "completed",
          fallbackReason: "low_similarity",
          state: metricState,
        });
        return { chatId: chat.id, status: "completed", fallback: "low_similarity" };
      }

      const sources = metricState.sources;
      metricState.generationAttempted = true;
      const answer = await measureDuration(
        (durationMs) => {
          metricState.generationDurationMs = durationMs;
        },
        () =>
          step.run("answer-from-chunks", () =>
            answerMeetingQuestionFromChunks({ question: chat.question, chunks: sources })
          )
      );
      metricState.answerText = answer.answer;
      metricState.answerModel = answer.modelName;

      if (!answer.isAnsweredFromContext) {
        await saveFallback(
          supabase,
          chat.id,
          "not_confirmed_by_model",
          queryEmbedding,
          sources
        );
        await recordMeetingChatAiMetric({
          supabase,
          requestId,
          startedAt,
          metricId,
          stage: "not_confirmed_by_model",
          chatId: chat.id,
          meetingId: chat.meeting_id,
          userId: chat.user_id,
          status: "completed",
          fallbackReason: "not_confirmed_by_model",
          state: metricState,
        });
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
        await recordMeetingChatAiMetric({
          supabase,
          requestId,
          startedAt,
          metricId,
          stage: "not_confirmed_by_model",
          chatId: chat.id,
          meetingId: chat.meeting_id,
          userId: chat.user_id,
          status: "completed",
          fallbackReason: "not_confirmed_by_model",
          state: metricState,
        });
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
      await recordMeetingChatAiMetric({
        supabase,
        requestId,
        startedAt,
        metricId,
        stage: "completed",
        chatId: chat.id,
        meetingId: chat.meeting_id,
        userId: chat.user_id,
        status: "completed",
        fallbackReason: null,
        state: metricState,
      });

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
      const rawMessage = getErrorMessage(error);
      const userFacingMessage = toUserFacingProviderErrorMessage(rawMessage);
      await saveProviderFailure(supabase, data.chatId, userFacingMessage);
      await refundProviderErrorQuota({
        supabase,
        requestId,
        startedAt,
        userId: data.userId,
        chatId: data.chatId,
      });
      await recordMeetingChatAiMetric({
        supabase,
        requestId,
        startedAt,
        metricId,
        stage: "provider_error",
        errorMessage: rawMessage,
        chatId: data.chatId,
        meetingId: data.meetingId,
        userId: data.userId,
        status: "failed",
        fallbackReason: "provider_error",
        state: metricState,
      });

      logStructured("error", {
        event: "meeting.chat.answer.failed",
        requestId,
        userId: data.userId,
        route: "inngest/answer-meeting-chat",
        durationMs: Date.now() - startedAt,
        status: "failed",
        chatId: data.chatId,
        meetingId: data.meetingId,
        errorMessage: rawMessage,
      });

      captureObservedError(error, {
        event: "meeting.chat.answer.failed",
        requestId,
        userId: data.userId,
        route: "inngest/answer-meeting-chat",
        durationMs: Date.now() - startedAt,
        status: "failed",
        extra: {
          functionId: "answer-meeting-chat",
          eventName: event.name,
          chatId: data.chatId,
          meetingId: data.meetingId,
          metricId,
        },
      });

      return { chatId: data.chatId, status: "failed" };
    }
  }
);
