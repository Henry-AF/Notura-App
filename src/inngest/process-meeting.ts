// ─────────────────────────────────────────────────────────────────────────────
// Inngest function: process-meeting
// Trigger: 'meeting/process'
// Transcribes audio, summarizes via Gemini, saves results, sends WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { inngest } from "@/lib/inngest";
import { getWhatsAppSummaryAccess } from "@/lib/billing/whatsapp-summary-access";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPresignedDownloadUrl, deleteAudio } from "@/lib/r2";
import { sendMeetingSummaryTemplate, alertOperator } from "@/lib/whatsapp";
import {
  PROCESS_MEETING_CONCURRENCY,
  PROCESS_MEETING_RETRY_ATTEMPTS,
  toNonRetriableJobError,
  toProviderQueueError,
} from "@/lib/jobs/meeting-queue-guardrails";
import { AssemblyAI } from "assemblyai";
import {
  generateEmbedding,
  generateMeetingSummary,
  PROMPT_VERSION,
} from "@/lib/gemini";
import { indexMeetingTranscriptChunks } from "@/lib/meetings/rag";
import { upsertMeetingParticipants } from "@/lib/meetings/participants";
import { rewriteStructuredSummaryRefs } from "@/lib/meetings/summary-structured";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type {
  Json,
  MeetingJSON,
  MeetingStatus,
} from "@/types/database";

// ── External clients ─────────────────────────────────────────────────────────

function getAAI() {
  return new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
}

// ── Types for Inngest event data ─────────────────────────────────────────────

interface MeetingProcessEventData {
  meetingId: string;
  r2Key: string;
  whatsappNumber: string;
  userId: string;
}

type SummaryItemKind = "task" | "decision" | "open_item";
type ProcessingStepName =
  | "update-status-processing"
  | "transcribe"
  | "index-transcript-chunks"
  | "summarize-meeting"
  | "save-results"
  | "send-whatsapp"
  | "cleanup";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;
type InngestStepTools = {
  run<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
};
type SupabaseSingleResult<T> = {
  data: T | null;
  error: { message: string } | null;
};
type TranscriptResult = Awaited<
  ReturnType<AssemblyAI["transcripts"]["transcribe"]>
>;
type TranscriptionStepResult = {
  transcript: string;
  durationSeconds: number | null;
  utterances: TranscriptResult["utterances"] | null;
};
type WhatsAppSummaryAccess = Awaited<ReturnType<typeof getWhatsAppSummaryAccess>>;
type ProcessingLogStep = ProcessingStepName | "validate-event-data" | null;

interface TrackedProcessingStepInput<T> {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  name: ProcessingStepName;
  fn: () => Promise<T> | T;
}

interface ProcessMeetingFailureInput {
  error: unknown;
  eventName: string;
  requestId: string;
  startedAt: number;
  userId: string | undefined;
  meetingId: string | undefined;
  processingJobId: string | null;
  currentStep: ProcessingLogStep;
}

interface ProcessMeetingRunInput {
  event: { id?: unknown; name: string; data: unknown };
  step: InngestStepTools;
}

interface ProcessMeetingState {
  userId: string | undefined;
  meetingId: string | undefined;
  processingJobId: string | null;
  currentStep: ProcessingLogStep;
}

interface ProcessingStepsInput {
  eventData: MeetingProcessEventData;
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  whatsappAccess: WhatsAppSummaryAccess;
  requestId: string;
  startedAt: number;
  state: ProcessMeetingState;
}

const USER_CANCELED_PROCESSING_MESSAGE = "Meeting processing was canceled by the user.";
const ACTIVE_PROCESSING_STATUSES = ["pending", "processing"];

function readRequiredEventString(
  payload: Record<string, unknown>,
  field: keyof MeetingProcessEventData,
  issues: string[]
): string {
  const value = payload[field];

  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    issues.push(`${field} must be a non-empty string`);
  }

  return trimmed;
}

function readOptionalEventString(
  payload: Record<string, unknown>,
  field: keyof MeetingProcessEventData,
  issues: string[]
): string {
  const value = payload[field];

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
    return "";
  }

  return value.trim();
}

function parseMeetingProcessEventData(payload: unknown): MeetingProcessEventData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(
      "Invalid meeting/process event payload: expected an object with meetingId, r2Key and userId."
    );
  }

  const record = payload as Record<string, unknown>;
  const issues: string[] = [];

  const parsed = {
    meetingId: readRequiredEventString(record, "meetingId", issues),
    r2Key: readRequiredEventString(record, "r2Key", issues),
    whatsappNumber: readOptionalEventString(record, "whatsappNumber", issues),
    userId: readRequiredEventString(record, "userId", issues),
  };

  if (issues.length > 0) {
    const payloadKeys = Object.keys(record);
    throw new Error(
      `Invalid meeting/process event payload: ${issues.join("; ")}. Received keys: ${
        payloadKeys.length > 0 ? payloadKeys.join(", ") : "(none)"
      }.`
    );
  }

  return parsed;
}

function normalizeSummaryField(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildSummaryItemSignature(
  kind: SummaryItemKind,
  fields: Array<string | null | undefined>
): string {
  return [kind, ...fields.map(normalizeSummaryField)].join("::");
}

function buildSummaryItemDedupeKeys<T>(
  items: T[],
  getSignature: (item: T) => string
): string[] {
  const occurrenceBySignature = new Map<string, number>();

  return items.map((item) => {
    const signature = getSignature(item);
    const occurrence = (occurrenceBySignature.get(signature) ?? 0) + 1;
    occurrenceBySignature.set(signature, occurrence);

    return createHash("sha256")
      .update(`v1::${signature}::${occurrence}`)
      .digest("hex");
  });
}

function resolveInngestRequestId(eventId: unknown): string {
  if (typeof eventId !== "string") return createTraceId();
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : createTraceId();
}

async function createProcessingJob(
  supabase: ServiceRoleClient,
  meetingId: string
): Promise<string> {
  const result = await supabase
    .from("jobs")
    .insert({
      meeting_id: meetingId,
      status: "processing",
      current_step: "update-status-processing",
      error_message: null,
    })
    .select("id")
    .single();

  return unwrapProcessingJobId(result);
}

async function updateProcessingJobStep(
  supabase: ServiceRoleClient,
  jobId: string,
  currentStep: ProcessingStepName
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "processing",
      current_step: currentStep,
      error_message: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to update processing job step: ${error.message}`);
  }
}

async function assertMeetingProcessingIsActive(
  supabase: ServiceRoleClient,
  meetingId: string
) {
  const result = await supabase
    .from("meetings")
    .select("status")
    .eq("id", meetingId)
    .single();

  const status = unwrapMeetingStatus(result);

  if (!ACTIVE_PROCESSING_STATUSES.includes(status)) {
    throw toNonRetriableJobError(USER_CANCELED_PROCESSING_MESSAGE);
  }
}

async function completeProcessingJob(
  supabase: ServiceRoleClient,
  jobId: string
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "completed",
      current_step: "cleanup",
      error_message: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to complete processing job: ${error.message}`);
  }
}

async function failProcessingJob(
  supabase: ServiceRoleClient,
  jobId: string,
  message: string
) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[process-meeting] Failed to mark processing job as failed:", error);
  }
}

async function runTrackedProcessingStep<T>(
  input: TrackedProcessingStepInput<T>
): Promise<T> {
  const result = await input.step.run(input.name, async () => {
    const { supabase, meetingId, jobId, name, fn } = input;
    await assertMeetingProcessingIsActive(supabase, meetingId);
    await updateProcessingJobStep(supabase, jobId, name);
    return await fn();
  });

  return result as T;
}

function unwrapProcessingJobId(
  result: SupabaseSingleResult<{ id: string }>
): string {
  if (result.error) {
    throw new Error(`Failed to create processing job: ${result.error.message}`);
  }

  if (result.data === null) {
    throw new Error("Failed to create processing job: missing job id");
  }

  return result.data.id;
}

function unwrapMeetingStatus(
  result: SupabaseSingleResult<{ status: MeetingStatus }>
): MeetingStatus {
  if (result.error || result.data === null) {
    throw toNonRetriableJobError(
      "Meeting processing stopped because the meeting could not be loaded.",
      result.error
    );
  }

  return result.data.status;
}

async function runValidateEventData(
  step: InngestStepTools,
  payload: unknown
): Promise<MeetingProcessEventData> {
  return step.run("validate-event-data", () => {
    try {
      return parseMeetingProcessEventData(payload);
    } catch (error) {
      throw toNonRetriableJobError(
        "Invalid meeting/process event payload",
        error
      );
    }
  });
}

async function runCheckWhatsAppAccess(
  step: InngestStepTools,
  userId: string,
  supabase: ServiceRoleClient
) {
  return step.run("check-whatsapp-summary-access", () =>
    getWhatsAppSummaryAccess(userId, supabase)
  );
}

async function runInitialProcessingStep(
  step: InngestStepTools,
  supabase: ServiceRoleClient,
  meetingId: string
): Promise<string | null> {
  return step.run("update-status-processing", async () => {
    const status = await readExistingMeetingStatus(supabase, meetingId);

    if (status === "completed") {
      return null;
    }

    if (status === null || !ACTIVE_PROCESSING_STATUSES.includes(status)) {
      throw toNonRetriableJobError(USER_CANCELED_PROCESSING_MESSAGE);
    }

    await markMeetingStatusAsProcessing(supabase, meetingId);
    return createProcessingJob(supabase, meetingId);
  });
}

async function readExistingMeetingStatus(
  supabase: ServiceRoleClient,
  meetingId: string
): Promise<MeetingStatus | null> {
  const result: SupabaseSingleResult<{ status: MeetingStatus }> = await supabase
    .from("meetings")
    .select("status")
    .eq("id", meetingId)
    .single();

  if (result.error || result.data === null) {
    return null;
  }

  return result.data.status;
}

async function markMeetingStatusAsProcessing(
  supabase: ServiceRoleClient,
  meetingId: string
) {
  const { error } = await supabase
    .from("meetings")
    .update({ status: "processing" })
    .eq("id", meetingId);

  if (error) throw new Error(`Failed to update status: ${error.message}`);
}

async function runTranscriptionStep(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  r2Key: string;
}): Promise<TranscriptionStepResult> {
  return runTrackedProcessingStep({
    ...input,
    name: "transcribe",
    fn: async () => {
      const transcriptResult = await fetchAssemblyTranscript(input.r2Key);
      const formattedTranscript = formatTranscriptText(transcriptResult);
      const durationSeconds = resolveTranscriptDurationSeconds(transcriptResult);
      await saveTranscriptMetadata({
        supabase: input.supabase,
        meetingId: input.meetingId,
        transcript: formattedTranscript,
        durationSeconds,
        transcriptId: transcriptResult.id,
      });

      return {
        transcript: formattedTranscript,
        durationSeconds,
        utterances: transcriptResult.utterances ?? null,
      };
    },
  });
}

async function fetchAssemblyTranscript(r2Key: string): Promise<TranscriptResult> {
  let audioUrl: string;
  try {
    audioUrl = await getPresignedDownloadUrl(r2Key, 3600);
  } catch (error) {
    throw toProviderQueueError("r2", error);
  }

  try {
    const aai = getAAI();
    const result = await aai.transcripts.transcribe({
      audio_url: audioUrl,
      speech_models: ["universal-3-pro"],
      language_code: "pt",
      speaker_labels: true,
      punctuate: true,
      format_text: true,
      disfluencies: false,
    });

    return validateTranscriptResult(result);
  } catch (error) {
    throw toProviderQueueError("assemblyai", error);
  }
}

function validateTranscriptResult(result: TranscriptResult): TranscriptResult {
  if (result.status === "error") {
    throw new Error(`AssemblyAI transcription failed: ${result.error}`);
  }

  if (!result.text) {
    throw new Error("AssemblyAI returned empty transcript");
  }

  return result;
}

function formatTranscriptText(transcriptResult: TranscriptResult): string {
  const utterances = transcriptResult.utterances;
  if (!utterances || utterances.length === 0) {
    return transcriptResult.text;
  }

  return utterances.map(formatTranscriptUtterance).join("\n\n");
}

function formatTranscriptUtterance(
  utterance: NonNullable<TranscriptResult["utterances"]>[number]
): string {
  const startSec = Math.floor(utterance.start / 1000);
  const mm = Math.floor(startSec / 60).toString().padStart(2, "0");
  const ss = (startSec % 60).toString().padStart(2, "0");
  return `[${mm}:${ss}] Speaker ${utterance.speaker}: ${utterance.text}`;
}

function resolveTranscriptDurationSeconds(
  transcriptResult: TranscriptResult
): number | null {
  return transcriptResult.audio_duration
    ? Math.round(transcriptResult.audio_duration)
    : null;
}

function resolveTranscriptCostUsd(durationSeconds: number | null): number | null {
  return durationSeconds
    ? parseFloat(((durationSeconds / 3600) * 0.37).toFixed(4))
    : null;
}

async function saveTranscriptMetadata(input: {
  supabase: ServiceRoleClient;
  meetingId: string;
  transcript: string;
  durationSeconds: number | null;
  transcriptId: string;
}) {
  const { error: saveError } = await input.supabase
    .from("meetings")
    .update({
      transcript: input.transcript,
      duration_seconds: input.durationSeconds,
      cost_usd: resolveTranscriptCostUsd(input.durationSeconds),
    })
    .eq("id", input.meetingId);

  if (saveError) {
    throw new Error(`Failed to save transcript: ${saveError.message}`);
  }

  await saveAssemblyTranscriptId(input);
}

async function saveAssemblyTranscriptId(input: {
  supabase: ServiceRoleClient;
  meetingId: string;
  transcriptId: string;
}) {
  const { error } = await input.supabase
    .from("meetings")
    .update({ assemblyai_transcript_id: input.transcriptId })
    .eq("id", input.meetingId);

  if (error) {
    console.warn(
      "[process-meeting] Could not save assemblyai_transcript_id (run migration 002?):",
      error.message
    );
  }
}

async function runIndexTranscriptStep(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  userId: string;
  transcript: string;
  utterances: TranscriptResult["utterances"] | null;
}) {
  await runTrackedProcessingStep({
    ...input,
    name: "index-transcript-chunks",
    fn: async () => {
      await indexMeetingTranscriptChunks({
        supabase: input.supabase,
        meetingId: input.meetingId,
        userId: input.userId,
        transcript: input.transcript,
        utterances: input.utterances,
        embedText: generateEmbedding,
      });
    },
  });
}

async function runSummaryStep(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  transcript: string;
  durationSeconds: number | null;
}) {
  return runTrackedProcessingStep({
    ...input,
    name: "summarize-meeting",
    fn: async () => {
      try {
        return await generateMeetingSummary(
          input.transcript,
          input.durationSeconds
        );
      } catch (error) {
        throw toProviderQueueError("gemini", error);
      }
    },
  });
}

async function runSaveResultsStep(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  userId: string;
  summary: Awaited<ReturnType<typeof generateMeetingSummary>>;
}) {
  await runTrackedProcessingStep({
    step: input.step,
    supabase: input.supabase,
    jobId: input.jobId,
    meetingId: input.meetingId,
    name: "save-results",
    fn: () => saveMeetingSummaryResults(input),
  });
}

async function saveMeetingSummaryResults(input: {
  supabase: ServiceRoleClient;
  meetingId: string;
  userId: string;
  summary: Awaited<ReturnType<typeof generateMeetingSummary>>;
}) {
  const { participants, summaryStructured, summaryJson } = input.summary;
  const participantRefMap = await upsertMeetingParticipants({
    supabase: input.supabase,
    meetingId: input.meetingId,
    participants,
  });
  const persistedStructuredSummary = rewriteStructuredSummaryRefs(
    summaryStructured,
    participantRefMap
  );

  await upsertSummaryTasks(input.supabase, input.meetingId, input.userId, summaryJson);
  await upsertSummaryDecisions(input.supabase, input.meetingId, input.userId, summaryJson);
  await upsertSummaryOpenItems(input.supabase, input.meetingId, input.userId, summaryJson);
  await updateMeetingSummary(input, persistedStructuredSummary);
}

async function upsertSummaryTasks(
  supabase: ServiceRoleClient,
  meetingId: string,
  userId: string,
  summaryJson: MeetingJSON
) {
  if (summaryJson.tasks.length === 0) return;
  const dedupeKeys = buildSummaryItemDedupeKeys(summaryJson.tasks, (task) =>
    buildSummaryItemSignature("task", [
      task.description,
      task.owner === "indefinido" ? null : task.owner,
      task.due_date,
      task.priority,
    ])
  );
  const rows = summaryJson.tasks.map((task, index) => ({
    meeting_id: meetingId,
    user_id: userId,
    dedupe_key: dedupeKeys[index],
    description: task.description,
    owner: task.owner === "indefinido" ? null : task.owner,
    due_date: task.due_date,
    priority: task.priority,
  }));
  const { error } = await supabase
    .from("tasks")
    .upsert(rows, { onConflict: "meeting_id,dedupe_key" });
  if (error) throw new Error(`Failed to upsert tasks: ${error.message}`);
}

async function upsertSummaryDecisions(
  supabase: ServiceRoleClient,
  meetingId: string,
  userId: string,
  summaryJson: MeetingJSON
) {
  if (summaryJson.decisions.length === 0) return;
  const dedupeKeys = buildSummaryItemDedupeKeys(summaryJson.decisions, (decision) =>
    buildSummaryItemSignature("decision", [
      decision.description,
      decision.decided_by,
      decision.confidence,
    ])
  );
  const rows = summaryJson.decisions.map((decision, index) => ({
    meeting_id: meetingId,
    user_id: userId,
    dedupe_key: dedupeKeys[index],
    description: decision.description,
    decided_by: decision.decided_by,
    confidence: decision.confidence,
  }));
  const { error } = await supabase
    .from("decisions")
    .upsert(rows, { onConflict: "meeting_id,dedupe_key" });
  if (error) throw new Error(`Failed to upsert decisions: ${error.message}`);
}

async function upsertSummaryOpenItems(
  supabase: ServiceRoleClient,
  meetingId: string,
  userId: string,
  summaryJson: MeetingJSON
) {
  if (summaryJson.open_items.length === 0) return;
  const dedupeKeys = buildSummaryItemDedupeKeys(summaryJson.open_items, (item) =>
    buildSummaryItemSignature("open_item", [item.description, item.context])
  );
  const rows = summaryJson.open_items.map((item, index) => ({
    meeting_id: meetingId,
    user_id: userId,
    dedupe_key: dedupeKeys[index],
    description: item.description,
    context: item.context,
  }));
  const { error } = await supabase
    .from("open_items")
    .upsert(rows, { onConflict: "meeting_id,dedupe_key" });
  if (error) throw new Error(`Failed to upsert open items: ${error.message}`);
}

async function updateMeetingSummary(
  input: {
    supabase: ServiceRoleClient;
    meetingId: string;
    summary: Awaited<ReturnType<typeof generateMeetingSummary>>;
  },
  summaryStructured: ReturnType<typeof rewriteStructuredSummaryRefs>
) {
  const { summaryWhatsapp, summaryJson } = input.summary;
  const { error } = await input.supabase
    .from("meetings")
    .update({
      summary_whatsapp: summaryWhatsapp,
      summary_json: summaryJson as unknown as Json,
      summary_structured: summaryStructured as unknown as Json,
      summary_version: summaryStructured.version,
      title:
        summaryStructured.title ??
        summaryJson.meeting?.title ??
        "Reunião processada",
      prompt_version: PROMPT_VERSION,
    })
    .eq("id", input.meetingId);

  if (error) throw new Error(`Failed to save results: ${error.message}`);
}

async function runWhatsAppStep(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  whatsappNumber: string;
  summaryJson: MeetingJSON;
}) {
  await runTrackedProcessingStep({
    ...input,
    name: "send-whatsapp",
    fn: async () => {
      const result = await sendMeetingSummaryTemplate(
        input.whatsappNumber,
        input.summaryJson,
        input.meetingId,
        input.summaryJson.meeting?.title
      );
      const newStatus = result.success ? "sent" : "failed";
      await updateMeetingWhatsAppStatus(input.supabase, input.meetingId, {
        whatsapp_status: newStatus,
        error_message: result.success
          ? null
          : `WhatsApp template send failed: ${result.error ?? "unknown error"}`,
      });

      if (!result.success) {
        console.error(
          `[process-meeting] WhatsApp send failed for meeting ${input.meetingId}: ${result.error}`
        );
      }
    },
  });
}

async function handleWhatsAppDelivery(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  whatsappNumber: string;
  summaryJson: MeetingJSON;
  whatsappAccess: WhatsAppSummaryAccess;
  requestId: string;
  userId: string;
  startedAt: number;
}) {
  if (input.whatsappAccess.canSend && input.whatsappNumber) {
    await runWhatsAppStep(input);
    return;
  }

  if (input.whatsappAccess.canSend) {
    await markMissingWhatsAppNumber(input.supabase, input.meetingId);
    return;
  }

  logSkippedWhatsApp(input);
}

async function updateMeetingWhatsAppStatus(
  supabase: ServiceRoleClient,
  meetingId: string,
  payload: { whatsapp_status: "sent" | "failed"; error_message: string | null }
) {
  await supabase.from("meetings").update(payload).eq("id", meetingId);
}

async function markMissingWhatsAppNumber(
  supabase: ServiceRoleClient,
  meetingId: string
) {
  await updateMeetingWhatsAppStatus(supabase, meetingId, {
    whatsapp_status: "failed",
    error_message: "Número de WhatsApp ausente para envio do resumo.",
  });
}

function logSkippedWhatsApp(input: {
  requestId: string;
  userId: string;
  startedAt: number;
}) {
  logStructured("info", {
    event: "whatsapp.summary.skipped",
    requestId: input.requestId,
    userId: input.userId,
    route: "inngest/process-meeting",
    durationMs: Date.now() - input.startedAt,
    status: "skipped-free-plan",
  });
}

async function runCleanupStep(input: {
  step: InngestStepTools;
  supabase: ServiceRoleClient;
  jobId: string;
  meetingId: string;
  r2Key: string;
}) {
  await runTrackedProcessingStep({
    ...input,
    name: "cleanup",
    fn: async () => {
      const audioDeleted = await deleteMeetingAudio(input.r2Key);
      const { error } = await input.supabase
        .from("meetings")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          ...(audioDeleted ? { audio_r2_key: null } : {}),
        })
        .eq("id", input.meetingId);

      if (error) {
        throw new Error(`Failed to mark meeting as completed: ${error.message}`);
      }

      await completeProcessingJob(input.supabase, input.jobId);
    },
  });
}

async function deleteMeetingAudio(r2Key: string): Promise<boolean> {
  try {
    await deleteAudio(r2Key);
    return true;
  } catch (error) {
    console.error("[process-meeting] Failed to delete audio from R2:", error);
    return false;
  }
}

function logCompletedJob(input: {
  requestId: string;
  userId: string | undefined;
  startedAt: number;
  status: string;
}) {
  logStructured("info", {
    event: "inngest.job.completed",
    requestId: input.requestId,
    userId: input.userId,
    route: "inngest/process-meeting",
    durationMs: Date.now() - input.startedAt,
    status: input.status,
  });
}

async function handleProcessMeetingError(input: ProcessMeetingFailureInput) {
  const durationMs = Date.now() - input.startedAt;
  const message = getErrorMessage(input.error);

  logStructured("error", {
    event: "inngest.job.failed",
    requestId: input.requestId,
    userId: input.userId,
    route: "inngest/process-meeting",
    durationMs,
    status: "failed",
    errorMessage: message,
  });

  captureObservedError(input.error, {
    event: "inngest.job.failed",
    requestId: input.requestId,
    userId: input.userId,
    route: "inngest/process-meeting",
    durationMs,
    status: "failed",
    extra: {
      functionId: "process-meeting",
      eventName: input.eventName,
      meetingId: input.meetingId,
      processingStep: input.currentStep,
    },
  });

  if (input.processingJobId) {
    await failProcessingJob(
      createServiceRoleClient(),
      input.processingJobId,
      message
    );
  }
}

function readFailureEventData(payload: unknown): MeetingProcessEventData | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const eventPayload = (payload as { event?: unknown }).event;
  if (!eventPayload || typeof eventPayload !== "object") return undefined;

  const data = (eventPayload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  return data as MeetingProcessEventData;
}

function readFailureErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Unknown error";
  const errorPayload = (payload as { error?: unknown }).error;
  if (!errorPayload || typeof errorPayload !== "object") return "Unknown error";

  const message = (errorPayload as { message?: unknown }).message;
  return typeof message === "string" ? message : "Unknown error";
}

async function runProcessMeetingFunction(input: ProcessMeetingRunInput) {
  const startedAt = Date.now();
  const requestId = resolveInngestRequestId(input.event.id);
  const state: ProcessMeetingState = {
    userId: undefined,
    meetingId: undefined,
    processingJobId: null,
    currentStep: null,
  };

  try {
    return await runProcessMeetingPipeline(input, state, startedAt, requestId);
  } catch (error) {
    await handleProcessMeetingError({
      error,
      eventName: input.event.name,
      requestId,
      startedAt,
      userId: state.userId,
      meetingId: state.meetingId,
      processingJobId: state.processingJobId,
      currentStep: state.currentStep,
    });

    throw error;
  }
}

async function runProcessMeetingPipeline(
  input: ProcessMeetingRunInput,
  state: ProcessMeetingState,
  startedAt: number,
  requestId: string
) {
  state.currentStep = "validate-event-data";
  const eventData = await runValidateEventData(input.step, input.event.data);
  state.userId = eventData.userId;
  state.meetingId = eventData.meetingId;
  const supabase = createServiceRoleClient();
  const whatsappAccess = await runCheckWhatsAppAccess(
    input.step,
    eventData.userId,
    supabase
  );

  state.currentStep = "update-status-processing";
  const jobId = await runInitialProcessingStep(
    input.step,
    supabase,
    eventData.meetingId
  );
  if (jobId === null) {
    return completeAlreadyProcessedRun(eventData.meetingId, requestId, state, startedAt);
  }

  state.processingJobId = jobId;
  const result = await runProcessingSteps({
    eventData,
    step: input.step,
    supabase,
    jobId,
    whatsappAccess,
    requestId,
    startedAt,
    state,
  });
  return result;
}

function completeAlreadyProcessedRun(
  meetingId: string,
  requestId: string,
  state: ProcessMeetingState,
  startedAt: number
) {
  const skippedResult = { meetingId, status: "skipped-already-completed" };
  logCompletedJob({
    requestId,
    userId: state.userId,
    startedAt,
    status: skippedResult.status,
  });
  return skippedResult;
}

async function runProcessingSteps(input: ProcessingStepsInput) {
  const { eventData, step, supabase, jobId, state } = input;
  state.currentStep = "transcribe";
  const transcription = await runTranscriptionStep({
    step,
    supabase,
    jobId,
    meetingId: eventData.meetingId,
    r2Key: eventData.r2Key,
  });

  state.currentStep = "index-transcript-chunks";
  await runIndexTranscriptStep({
    step,
    supabase,
    jobId,
    meetingId: eventData.meetingId,
    userId: eventData.userId,
    transcript: transcription.transcript,
    utterances: transcription.utterances,
  });

  return runSummarySaveAndDelivery(input, transcription);
}

async function runSummarySaveAndDelivery(
  input: ProcessingStepsInput,
  transcription: TranscriptionStepResult
) {
  const { eventData, step, supabase, jobId, state } = input;
  state.currentStep = "summarize-meeting";
  const summary = await runSummaryStep({
    step,
    supabase,
    jobId,
    meetingId: eventData.meetingId,
    transcript: transcription.transcript,
    durationSeconds: transcription.durationSeconds,
  });

  state.currentStep = "save-results";
  await runSaveResultsStep({
    step,
    supabase,
    jobId,
    meetingId: eventData.meetingId,
    userId: eventData.userId,
    summary,
  });

  state.currentStep = "send-whatsapp";
  await handleWhatsAppDelivery({
    ...input,
    meetingId: eventData.meetingId,
    whatsappNumber: eventData.whatsappNumber,
    summaryJson: summary.summaryJson,
    userId: eventData.userId,
  });

  state.currentStep = "cleanup";
  await runCleanupStep({
    step,
    supabase,
    jobId,
    meetingId: eventData.meetingId,
    r2Key: eventData.r2Key,
  });

  return completeProcessedRun(eventData.meetingId, input);
}

function completeProcessedRun(meetingId: string, input: ProcessingStepsInput) {
  const completedResult = { meetingId, status: "completed" };
  logCompletedJob({
    requestId: input.requestId,
    userId: input.state.userId,
    status: completedResult.status,
    startedAt: input.startedAt,
  });
  return completedResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Inngest function
// ─────────────────────────────────────────────────────────────────────────────

export const processMeeting = inngest.createFunction(
  {
    id: "process-meeting",
    retries: PROCESS_MEETING_RETRY_ATTEMPTS,
    concurrency: PROCESS_MEETING_CONCURRENCY,
    triggers: [{ event: "meeting/process" }],
  },
  runProcessMeetingFunction
);

// ─────────────────────────────────────────────────────────────────────────────
// Failure handler — separate function to avoid EventValidationError.
// The inline onFailure in createFunction config causes validateEventSchemas()
// to check inngest/function.failed against the main trigger (meeting/process),
// which throws. A standalone function has its own trigger list.
// ─────────────────────────────────────────────────────────────────────────────

export const handleProcessMeetingFailure = inngest.createFunction(
  {
    id: "process-meeting-failure",
    retries: 1,
    triggers: [
      {
        event: "inngest/function.failed",
        // Scope to this function only (SDK prefixes app ID: "notura-process-meeting")
        if: "event.data.function_id == 'notura-process-meeting'",
      },
    ],
  },
  async ({ event }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    let meetingIdForLog: string | undefined;

    try {
      const supabase = createServiceRoleClient();
      const eventData = readFailureEventData(event.data);
      const meetingId = eventData?.meetingId;
      meetingIdForLog = meetingId;
      const errorMessage = readFailureErrorMessage(event.data);
      const userId = eventData?.userId;

      if (meetingId) {
        await supabase
          .from("meetings")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", meetingId);
      }

      await alertOperator(
        `Processamento falhou para reunião ${meetingId ?? "desconhecida"}: ${errorMessage}`
      );

      captureObservedError(new Error("Meeting processing failed after retries"), {
        event: "inngest.process_meeting.final_failed",
        requestId,
        userId,
        route: "inngest/process-meeting-failure",
        durationMs: Date.now() - startedAt,
        status: "failed",
        extra: {
          functionId: "process-meeting",
          failureHandlerId: "process-meeting-failure",
          meetingId,
          errorMessage,
          originalEventName: eventData ? "meeting/process" : undefined,
        },
      });

      logStructured("info", {
        event: "inngest.job.completed",
        requestId,
        route: "inngest/process-meeting-failure",
        durationMs: Date.now() - startedAt,
        status: "handled",
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = getErrorMessage(error);

      logStructured("error", {
        event: "inngest.job.failed",
        requestId,
        route: "inngest/process-meeting-failure",
        durationMs,
        status: "failed",
        errorMessage: message,
      });

      captureObservedError(error, {
        event: "inngest.job.failed",
        requestId,
        route: "inngest/process-meeting-failure",
        durationMs,
        status: "failed",
        extra: {
          functionId: "process-meeting-failure",
          meetingId: meetingIdForLog,
          eventName: event.name,
        },
      });

      throw error;
    }
  }
);
