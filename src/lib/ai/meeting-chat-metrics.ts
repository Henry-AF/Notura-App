import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBEDDING_MODEL_NAME,
  GEMINI_TEXT_MODEL_NAME,
} from "@/lib/gemini";
import {
  estimateTokenCount,
  type ChatSource,
  type MeetingChatFallbackReason,
} from "@/lib/meetings/rag";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;
type MeetingChatAiMetricInsert =
  Database["public"]["Tables"]["meeting_chat_ai_metrics"]["Insert"];
type MeetingChatAiMetricStatus = "completed" | "failed";

interface MeetingChatAiMetricInput {
  chatId: string;
  meetingId: string;
  userId: string;
  question: string;
  status: MeetingChatAiMetricStatus;
  fallbackReason: MeetingChatFallbackReason | null;
  sources: ChatSource[];
  answerText: string | null;
  questionEmbeddingGenerated: boolean;
  generationAttempted: boolean;
  embeddingDurationMs: number | null;
  retrievalDurationMs: number | null;
  generationDurationMs: number | null;
  totalDurationMs: number;
}

interface EstimatedCostInput {
  questionTokens: number;
  contextTokens: number;
  answerTokens: number;
  questionEmbeddingGenerated: boolean;
  generationAttempted: boolean;
}

const USD_PER_MILLION = 1_000_000;
const GEMINI_EMBEDDING_001_INPUT_USD_PER_MILLION_TOKENS = 0.15;
const GEMINI_FLASH_LITE_INPUT_USD_PER_MILLION_TOKENS = 0.25;
const GEMINI_FLASH_LITE_OUTPUT_USD_PER_MILLION_TOKENS = 1.5;

export function buildMeetingChatAiMetric(
  input: MeetingChatAiMetricInput
): MeetingChatAiMetricInsert {
  const questionTokens = estimateTokenCount(input.question);
  const contextTokens = estimateSourcesTokenCount(input.sources);
  const answerTokens = input.answerText ? estimateTokenCount(input.answerText) : 0;
  const similarities = input.sources.map((source) => source.similarity);

  return {
    chat_id: input.chatId,
    meeting_id: input.meetingId,
    user_id: input.userId,
    status: input.status,
    fallback_reason: input.fallbackReason,
    embedding_model: EMBEDDING_MODEL_NAME,
    answer_model: GEMINI_TEXT_MODEL_NAME,
    retrieved_chunks_count: input.sources.length,
    max_similarity: maxOrNull(similarities),
    avg_similarity: averageOrNull(similarities),
    question_tokens_estimated: questionTokens,
    context_tokens_estimated: contextTokens,
    answer_tokens_estimated: answerTokens,
    embedding_duration_ms: input.embeddingDurationMs,
    retrieval_duration_ms: input.retrievalDurationMs,
    generation_duration_ms: input.generationDurationMs,
    total_duration_ms: input.totalDurationMs,
    estimated_cost_usd: estimateMeetingChatCostUsd({
      questionTokens,
      contextTokens,
      answerTokens,
      questionEmbeddingGenerated: input.questionEmbeddingGenerated,
      generationAttempted: input.generationAttempted,
    }),
  };
}

export async function insertMeetingChatAiMetric(
  supabase: SupabaseAdminClient,
  metric: MeetingChatAiMetricInsert
): Promise<void> {
  const { error } = await supabase.from("meeting_chat_ai_metrics").insert(metric);
  if (error) throw new Error(`Failed to insert meeting chat AI metrics: ${error.message}`);
}

function estimateSourcesTokenCount(sources: ChatSource[]): number {
  return sources.reduce((total, source) => total + estimateTokenCount(source.text), 0);
}

function maxOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function estimateMeetingChatCostUsd(input: EstimatedCostInput): number {
  const embeddingCost = input.questionEmbeddingGenerated
    ? priceTokens(input.questionTokens, GEMINI_EMBEDDING_001_INPUT_USD_PER_MILLION_TOKENS)
    : 0;
  const generationInputCost = input.generationAttempted
    ? priceTokens(
        input.questionTokens + input.contextTokens,
        GEMINI_FLASH_LITE_INPUT_USD_PER_MILLION_TOKENS
      )
    : 0;
  const generationOutputCost = input.generationAttempted
    ? priceTokens(input.answerTokens, GEMINI_FLASH_LITE_OUTPUT_USD_PER_MILLION_TOKENS)
    : 0;

  return roundCurrency(embeddingCost + generationInputCost + generationOutputCost);
}

function priceTokens(tokens: number, usdPerMillionTokens: number): number {
  return (tokens * usdPerMillionTokens) / USD_PER_MILLION;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}
