import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GEMINI_TEXT_FALLBACK_MODEL_NAME,
  GEMINI_TEXT_MODEL_NAME,
} from "@/lib/gemini";
import { estimateTokenCount } from "@/lib/meetings/rag";
import type { Database, MeetingJSON } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;
type MeetingSummaryAiMetricInsert =
  Database["public"]["Tables"]["meeting_summary_ai_metrics"]["Insert"];
type MeetingSummaryAiMetricStatus = "processing" | "completed" | "failed";

interface MeetingSummaryAiMetricInput {
  meetingId: string;
  userId: string;
  requestId: string;
  stage: string;
  status: MeetingSummaryAiMetricStatus;
  errorMessage?: string | null;
  transcript: string;
  summaryWhatsapp: string | null;
  summaryJson: MeetingJSON | null;
  summaryModel: string;
  promptVersion: string;
  generationDurationMs: number | null;
  totalDurationMs: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

const USD_PER_MILLION = 1_000_000;
const GEMINI_FLASH_LITE_INPUT_USD_PER_MILLION_TOKENS = 0.25;
const GEMINI_FLASH_LITE_OUTPUT_USD_PER_MILLION_TOKENS = 1.5;

export function buildMeetingSummaryAiMetric(
  input: MeetingSummaryAiMetricInput
): MeetingSummaryAiMetricInsert {
  const transcriptTokens = estimateTokenCount(input.transcript);
  const summaryTokens = estimateSummaryTokenCount(
    input.summaryWhatsapp,
    input.summaryJson
  );

  return {
    meeting_id: input.meetingId,
    user_id: input.userId,
    status: input.status,
    request_id: input.requestId,
    stage: input.stage,
    error_message: input.errorMessage ?? null,
    primary_model: GEMINI_TEXT_MODEL_NAME,
    fallback_model: GEMINI_TEXT_FALLBACK_MODEL_NAME,
    summary_model: input.summaryModel,
    used_fallback: input.summaryModel !== GEMINI_TEXT_MODEL_NAME,
    prompt_version: input.promptVersion,
    transcript_tokens_estimated: transcriptTokens,
    summary_tokens_estimated: summaryTokens,
    generation_duration_ms: input.generationDurationMs,
    total_duration_ms: input.totalDurationMs,
    estimated_cost_usd: estimateMeetingSummaryCostUsd(
      transcriptTokens,
      summaryTokens,
      input.status !== "processing"
    ),
    started_at: input.startedAt,
    completed_at: input.completedAt,
    updated_at: new Date().toISOString(),
  };
}

export async function insertMeetingSummaryAiMetric(
  supabase: SupabaseAdminClient,
  metric: MeetingSummaryAiMetricInsert
): Promise<string> {
  const { data, error } = await supabase
    .from("meeting_summary_ai_metrics")
    .insert(metric)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert meeting summary AI metrics: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Failed to insert meeting summary AI metrics: missing metric id");
  }
  return data.id;
}

function estimateSummaryTokenCount(
  summaryWhatsapp: string | null,
  summaryJson: MeetingJSON | null
): number {
  const jsonText = summaryJson ? JSON.stringify(summaryJson) : "";
  return estimateTokenCount(`${summaryWhatsapp ?? ""} ${jsonText}`);
}

function estimateMeetingSummaryCostUsd(
  transcriptTokens: number,
  summaryTokens: number,
  generationAttempted: boolean
): number {
  if (!generationAttempted) return 0;
  const inputCost = priceTokens(
    transcriptTokens,
    GEMINI_FLASH_LITE_INPUT_USD_PER_MILLION_TOKENS
  );
  const outputCost = priceTokens(
    summaryTokens,
    GEMINI_FLASH_LITE_OUTPUT_USD_PER_MILLION_TOKENS
  );
  return roundCurrency(inputCost + outputCost);
}

function priceTokens(tokens: number, usdPerMillionTokens: number): number {
  return (tokens * usdPerMillionTokens) / USD_PER_MILLION;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}
