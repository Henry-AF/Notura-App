// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/assemblyai
//
// AssemblyAI calls this endpoint when a transcript is ready (or fails).
// This is the WEBHOOK ALTERNATIVE to the in-process polling used by the
// Inngest "transcribe" step. Use it when you want non-blocking transcription:
//
//   1. In process-meeting.ts, replace `aai.transcripts.transcribe()` with
//      `aai.transcripts.submit({ ..., webhook_url: WEBHOOK_URL,
//         webhook_auth_header_name: "x-assemblyai-secret",
//         webhook_auth_header_value: process.env.ASSEMBLYAI_WEBHOOK_SECRET })`.
//   2. Save the returned transcript.id as `assemblyai_transcript_id` in the DB.
//   3. Return early from the polling step (don't wait).
//   4. This endpoint receives the callback, updates the DB, then fires the
//      Inngest event `meeting/transcription.completed` to resume the pipeline.
//
// Security: AssemblyAI does not sign webhook payloads with HMAC. We protect
// the endpoint by sending a secret in a custom request header
// (x-assemblyai-secret) and validating it here via constant-time comparison
// to prevent timing-attack enumeration.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest";
import { timingSafeEqual } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssemblyAIWebhookPayload {
  transcript_id: string;
  status: "completed" | "error";
  // Present when status = "completed"
  text?: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number; // milliseconds
    end: number;
    confidence: number;
  }>;
  audio_duration?: number; // seconds
  auto_highlights_result?: {
    results: Array<{
      text: string;
      rank: number;
      count: number;
      timestamps: Array<{ start: number; end: number }>;
    }>;
  };
  // Present when status = "error"
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison — prevents timing-based secret enumeration.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // Encode to the same byte length before comparing
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function formatTranscript(payload: AssemblyAIWebhookPayload): string {
  if (payload.utterances && payload.utterances.length > 0) {
    return payload.utterances
      .map((u) => {
        const startSec = Math.floor((u.start ?? 0) / 1000);
        const mm = Math.floor(startSec / 60).toString().padStart(2, "0");
        const ss = (startSec % 60).toString().padStart(2, "0");
        return `[${mm}:${ss}] Speaker ${u.speaker}: ${u.text}`;
      })
      .join("\n\n");
  }
  return payload.text ?? "";
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const webhookSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[assemblyai-webhook] ASSEMBLYAI_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const incomingSecret = request.headers.get("x-assemblyai-secret") ?? "";
  if (!safeEqual(incomingSecret, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse payload ──────────────────────────────────────────────────────
  let payload: AssemblyAIWebhookPayload;
  try {
    payload = (await request.json()) as AssemblyAIWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { transcript_id, status } = payload;

  if (!transcript_id) {
    return NextResponse.json({ error: "Missing transcript_id" }, { status: 400 });
  }

  console.log(`[assemblyai-webhook] transcript_id=${transcript_id} status=${status}`);

  // ── 3. Look up the meeting ────────────────────────────────────────────────
  const supabase = createServiceRoleClient();

  const { data: meeting, error: lookupError } = await supabase
    .from("meetings")
    .select("id, user_id, whatsapp_number, audio_r2_key, status")
    .eq("assemblyai_transcript_id", transcript_id)
    .single();

  if (lookupError || !meeting) {
    // Could be a replay of a transcript this app didn't initiate — log and ack
    console.warn(
      `[assemblyai-webhook] No meeting found for transcript_id=${transcript_id}. Ignoring.`
    );
    return NextResponse.json({ ok: true });
  }

  // Guard: skip if the meeting was already completed by the polling path
  if (meeting.status === "completed") {
    return NextResponse.json({ ok: true });
  }

  // ── 4a. Handle transcription error ───────────────────────────────────────
  if (status === "error") {
    await supabase
      .from("meetings")
      .update({
        status: "failed",
        error_message: `AssemblyAI transcription error: ${payload.error ?? "unknown"}`,
      })
      .eq("id", meeting.id);

    console.error(
      `[assemblyai-webhook] Transcription error for meeting ${meeting.id}: ${payload.error}`
    );

    return NextResponse.json({ ok: true });
  }

  // ── 4b. Handle transcription success ─────────────────────────────────────
  const formattedTranscript = formatTranscript(payload);

  const durationSecs = payload.audio_duration
    ? Math.round(payload.audio_duration)
    : null;
  const costUsd = durationSecs
    ? parseFloat(((durationSecs / 3600) * 0.37).toFixed(4))
    : null;

  await supabase
    .from("meetings")
    .update({
      transcript: formattedTranscript,
      duration_seconds: durationSecs,
      cost_usd: costUsd,
    })
    .eq("id", meeting.id);

  // ── 5. Fire Inngest event to continue the summarization pipeline ──────────
  // The waiting Inngest step (step.waitForEvent) will resume on this event.
  await inngest.send({
    name: "meeting/transcription.completed",
    data: {
      meetingId: meeting.id,
      userId: meeting.user_id,
      whatsappNumber: meeting.whatsapp_number,
      r2Key: meeting.audio_r2_key,
      transcript: formattedTranscript,
    },
  });

  console.log(
    `[assemblyai-webhook] Fired meeting/transcription.completed for meeting=${meeting.id}`
  );

  return NextResponse.json({ ok: true });
}
