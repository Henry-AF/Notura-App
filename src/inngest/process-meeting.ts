// ─────────────────────────────────────────────────────────────────────────────
// Inngest function: process-meeting
// Trigger: 'meeting/process'
// Transcribes audio, summarizes via Gemini, saves results, sends WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { inngest } from "@/lib/inngest";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPresignedDownloadUrl, deleteAudio } from "@/lib/r2";
import { sendWhatsAppMessage, alertOperator } from "@/lib/whatsapp";
import {
  PROCESS_MEETING_CONCURRENCY,
  PROCESS_MEETING_RETRY_ATTEMPTS,
  toNonRetriableJobError,
  toProviderQueueError,
} from "@/lib/jobs/meeting-queue-guardrails";
import { AssemblyAI } from "assemblyai";
import {
  generateMeetingSummary,
  PROMPT_VERSION,
} from "@/lib/gemini";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type { Json, MeetingJSON, Priority, Confidence } from "@/types/database";

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

function parseMeetingProcessEventData(payload: unknown): MeetingProcessEventData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(
      "Invalid meeting/process event payload: expected an object with meetingId, r2Key, whatsappNumber and userId."
    );
  }

  const record = payload as Record<string, unknown>;
  const issues: string[] = [];

  const parsed = {
    meetingId: readRequiredEventString(record, "meetingId", issues),
    r2Key: readRequiredEventString(record, "r2Key", issues),
    whatsappNumber: readRequiredEventString(record, "whatsappNumber", issues),
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
  async ({ event, step }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    let userIdForLog: string | undefined;
    let meetingIdForLog: string | undefined;

    try {
      const { meetingId, r2Key, whatsappNumber, userId } = await step.run(
        "validate-event-data",
        async () => {
          try {
            return parseMeetingProcessEventData(event.data);
          } catch (error) {
            throw toNonRetriableJobError(
              "Invalid meeting/process event payload",
              error
            );
          }
        }
      );
      userIdForLog = userId;
      meetingIdForLog = meetingId;
      const supabase = createServiceRoleClient();

      // ── Step 1: Mark as processing ─────────────────────────────────────
      const alreadyCompleted = await step.run("update-status-processing", async () => {
        // Idempotency: if already completed, return true to short-circuit below.
        // IMPORTANT: never throw here — throwing causes Inngest to retry and
        // eventually mark the meeting as failed via the failure handler.
        const { data: existing } = await supabase
          .from("meetings")
          .select("status")
          .eq("id", meetingId)
          .single();

        if (existing?.status === "completed") {
          return true;
        }

        const { error } = await supabase
          .from("meetings")
          .update({ status: "processing" })
          .eq("id", meetingId);

        if (error) throw new Error(`Failed to update status: ${error.message}`);
        return false;
      });

      if (alreadyCompleted) {
        const skippedResult = { meetingId, status: "skipped-already-completed" };
        logStructured("info", {
          event: "inngest.job.completed",
          requestId,
          userId: userIdForLog,
          route: "inngest/process-meeting",
          durationMs: Date.now() - startedAt,
          status: skippedResult.status,
        });
        return skippedResult;
      }

      // ── Step 2: Transcribe audio ───────────────────────────────────────
      const transcript = await step.run("transcribe", async () => {
        // Presigned URL valid for 1 h — long enough for AssemblyAI to fetch the file.
        // NOTE: Webhook alternative — swap transcribe() for submit() and pass
        //   webhook_url + webhook_auth_header_name/value, then save the returned
        //   transcript.id as assemblyai_transcript_id. The webhook endpoint at
        //   /api/webhooks/assemblyai will fire meeting/transcription.completed to
        //   resume processing without blocking this worker.
        let audioUrl: string;
        try {
          audioUrl = await getPresignedDownloadUrl(r2Key, 3600);
        } catch (error) {
          throw toProviderQueueError("r2", error);
        }

        let transcriptResult: Awaited<ReturnType<AssemblyAI["transcripts"]["transcribe"]>>;
        try {
          const aai = getAAI();
          transcriptResult = await aai.transcripts.transcribe({
            audio_url: audioUrl,
            speech_models: ["universal-3-pro"], // highest accuracy; replaces deprecated speech_model
            language_code: "pt",
            speaker_labels: true,
            // ── Quality flags ──────────────────────────────────────────
            punctuate: true, // sentence-level punctuation
            format_text: true, // proper casing, numbers as words
            disfluencies: false, // strip fillers: "é...", "né...", "tipo..."
          });
        } catch (error) {
          throw toProviderQueueError("assemblyai", error);
        }

        if (transcriptResult.status === "error") {
          throw toProviderQueueError(
            "assemblyai",
            new Error(
              `AssemblyAI transcription failed: ${transcriptResult.error ?? "unknown error"}`
            )
          );
        }

        if (!transcriptResult.text) {
          throw toProviderQueueError(
            "assemblyai",
            new Error("AssemblyAI returned empty transcript")
          );
        }

        // Build transcript: prefer utterances (speaker + timestamp), fall back to full text
        let formattedTranscript = transcriptResult.text;

        if (transcriptResult.utterances && transcriptResult.utterances.length > 0) {
          formattedTranscript = transcriptResult.utterances
            .map((u) => {
              // Convert ms start offset to MM:SS timestamp
              const startSec = Math.floor((u.start ?? 0) / 1000);
              const mm = Math.floor(startSec / 60).toString().padStart(2, "0");
              const ss = (startSec % 60).toString().padStart(2, "0");
              return `[${mm}:${ss}] Speaker ${u.speaker}: ${u.text}`;
            })
            .join("\n\n");
        }

        // AssemblyAI Standard pricing: ~$0.37 / audio hour
        const durationSecs = transcriptResult.audio_duration
          ? Math.round(transcriptResult.audio_duration)
          : null;
        const costUsd = durationSecs
          ? parseFloat(((durationSecs / 3600) * 0.37).toFixed(4))
          : null;

        // Persist transcript + duration + cost immediately (partial save).
        // assemblyai_transcript_id is saved separately so that a missing column
        // (migration 002 not yet applied) doesn't silently discard the transcript.
        const { error: saveError } = await supabase
          .from("meetings")
          .update({
            transcript: formattedTranscript,
            duration_seconds: durationSecs,
            cost_usd: costUsd,
          })
          .eq("id", meetingId);

        if (saveError) {
          throw new Error(`Failed to save transcript: ${saveError.message}`);
        }

        // Best-effort: save AssemblyAI transcript ID for webhook correlation.
        // Requires migration 002. Failure here is non-critical.
        const { error: aaiIdError } = await supabase
          .from("meetings")
          .update({ assemblyai_transcript_id: transcriptResult.id })
          .eq("id", meetingId);

        if (aaiIdError) {
          console.warn(
            "[process-meeting] Could not save assemblyai_transcript_id (run migration 002?):",
            aaiIdError.message
          );
        }

        return formattedTranscript;
      });

      // ── Step 3: Generate WhatsApp + JSON summaries in one Gemini call ─
      const { summaryWhatsapp, summaryJson } = await step.run(
        "summarize-meeting",
        async () => {
          try {
            return await generateMeetingSummary(transcript);
          } catch (error) {
            throw toProviderQueueError("gemini", error);
          }
        }
      );

      // ── Step 4: Save results to Supabase ───────────────────────────────
      await step.run("save-results", async () => {
        const taskDedupeKeys = buildSummaryItemDedupeKeys(
          summaryJson.tasks,
          (task) =>
            buildSummaryItemSignature("task", [
              task.description,
              task.owner === "indefinido" ? null : task.owner,
              task.due_date ?? null,
              task.priority ?? "média",
            ])
        );

        const decisionDedupeKeys = buildSummaryItemDedupeKeys(
          summaryJson.decisions,
          (decision) =>
            buildSummaryItemSignature("decision", [
              decision.description,
              decision.decided_by ?? null,
              decision.confidence ?? "média",
            ])
        );

        const openItemDedupeKeys = buildSummaryItemDedupeKeys(
          summaryJson.open_items,
          (item) =>
            buildSummaryItemSignature("open_item", [
              item.description,
              item.context ?? null,
            ])
        );

        // Upsert tasks using a deterministic key so Inngest retries do not
        // duplicate rows if this step partially succeeds before failing.
        if (summaryJson.tasks && summaryJson.tasks.length > 0) {
          const tasksToUpsert = summaryJson.tasks.map(
            (task: MeetingJSON["tasks"][number], index) => ({
              meeting_id: meetingId,
              user_id: userId,
              dedupe_key: taskDedupeKeys[index],
              description: task.description,
              owner: task.owner === "indefinido" ? null : task.owner,
              due_date: task.due_date ?? null,
              priority: (task.priority ?? "média") as Priority,
            })
          );

          const { error: tasksError } = await supabase
            .from("tasks")
            .upsert(tasksToUpsert, {
              onConflict: "meeting_id,dedupe_key",
            });

          if (tasksError) {
            throw new Error(`Failed to upsert tasks: ${tasksError.message}`);
          }
        }

        // Upsert decisions using the same deterministic retry-safe strategy.
        if (summaryJson.decisions && summaryJson.decisions.length > 0) {
          const decisionsToUpsert = summaryJson.decisions.map(
            (decision: MeetingJSON["decisions"][number], index) => ({
              meeting_id: meetingId,
              user_id: userId,
              dedupe_key: decisionDedupeKeys[index],
              description: decision.description,
              decided_by: decision.decided_by ?? null,
              confidence: (decision.confidence ?? "média") as Confidence,
            })
          );

          const { error: decisionsError } = await supabase
            .from("decisions")
            .upsert(decisionsToUpsert, {
              onConflict: "meeting_id,dedupe_key",
            });

          if (decisionsError) {
            throw new Error(`Failed to upsert decisions: ${decisionsError.message}`);
          }
        }

        // Upsert open items so retried executions remain idempotent as well.
        if (summaryJson.open_items && summaryJson.open_items.length > 0) {
          const openItemsToUpsert = summaryJson.open_items.map(
            (item: MeetingJSON["open_items"][number], index) => ({
              meeting_id: meetingId,
              user_id: userId,
              dedupe_key: openItemDedupeKeys[index],
              description: item.description,
              context: item.context ?? null,
            })
          );

          const { error: openItemsError } = await supabase
            .from("open_items")
            .upsert(openItemsToUpsert, {
              onConflict: "meeting_id,dedupe_key",
            });

          if (openItemsError) {
            throw new Error(`Failed to upsert open items: ${openItemsError.message}`);
          }
        }

        // Update meeting with summaries
        const { error: updateError } = await supabase
          .from("meetings")
          .update({
            summary_whatsapp: summaryWhatsapp,
            summary_json: summaryJson as unknown as Json,
            title: summaryJson.meeting?.title ?? "Reunião processada",
            prompt_version: PROMPT_VERSION,
          })
          .eq("id", meetingId);

        if (updateError) {
          throw new Error(`Failed to save results: ${updateError.message}`);
        }
      });

      // ── Step 5: Send WhatsApp ──────────────────────────────────────────
      await step.run("send-whatsapp", async () => {
        const result = await sendWhatsAppMessage(whatsappNumber, summaryWhatsapp);

        const newStatus = result.success ? "sent" : "failed";
        await supabase
          .from("meetings")
          .update({ whatsapp_status: newStatus })
          .eq("id", meetingId);

        if (!result.success) {
          console.error(
            `[process-meeting] WhatsApp send failed for meeting ${meetingId}: ${result.error}`
          );
          // Don't throw — WhatsApp failure shouldn't fail the whole pipeline
          // User can resend manually
        }
      });

      // ── Step 6: Cleanup — delete audio from R2 (LGPD) ─────────────────
      await step.run("cleanup", async () => {
        let audioDeleted = false;

        try {
          await deleteAudio(r2Key);
          audioDeleted = true;
        } catch (error) {
          console.error("[process-meeting] Failed to delete audio from R2:", error);
          // Non-critical — log but don't fail the pipeline
        }

        const { error } = await supabase
          .from("meetings")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            ...(audioDeleted ? { audio_r2_key: null } : {}),
          })
          .eq("id", meetingId);

        if (error) {
          throw new Error(`Failed to mark meeting as completed: ${error.message}`);
        }
      });

      const completedResult = { meetingId, status: "completed" };
      logStructured("info", {
        event: "inngest.job.completed",
        requestId,
        userId: userIdForLog,
        route: "inngest/process-meeting",
        durationMs: Date.now() - startedAt,
        status: completedResult.status,
      });
      return completedResult;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = getErrorMessage(error);

      logStructured("error", {
        event: "inngest.job.failed",
        requestId,
        userId: userIdForLog,
        route: "inngest/process-meeting",
        durationMs,
        status: "failed",
        errorMessage: message,
      });

      captureObservedError(error, {
        event: "inngest.job.failed",
        requestId,
        userId: userIdForLog,
        route: "inngest/process-meeting",
        durationMs,
        status: "failed",
        extra: {
          functionId: "process-meeting",
          eventName: event.name,
          meetingId: meetingIdForLog,
        },
      });

      throw error;
    }
  }
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
      const eventData = (
        event.data as { event?: { data?: MeetingProcessEventData } }
      )?.event?.data;
      const meetingId = eventData?.meetingId;
      meetingIdForLog = meetingId;
      const errorMessage =
        (event.data as { error?: { message?: string } })?.error?.message ??
        "Unknown error";

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
