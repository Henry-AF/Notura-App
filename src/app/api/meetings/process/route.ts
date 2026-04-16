import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest";
import { getBillingStatus, syncMeetingsThisMonth } from "@/lib/billing";
import { validateMeetingDate } from "@/lib/meetings/meeting-date";
import { verifyUploadToken } from "@/lib/meetings/upload-token";
import {
  getWhatsappNumberValidationError,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";
import { getObjectMetadata } from "@/lib/r2";
import type { MeetingStatus, MeetingSource, WhatsAppStatus } from "@/types/database";

// ─── POST /api/meetings/process ───────────────────────────────────────────────
// Registers a meeting record for an already-uploaded audio file and enqueues
// processing. Expects the R2 key from a prior upload step.

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.meetingsProcess,
  async (req: NextRequest, { auth }) => {
    // ── Parse & validate body ────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;

    if (!data.clientName || typeof data.clientName !== "string" || !data.clientName.trim()) {
      return NextResponse.json({ error: "Nome do cliente é obrigatório." }, { status: 422 });
    }
    if (!data.meetingDate || typeof data.meetingDate !== "string") {
      return NextResponse.json({ error: "Data da reunião é obrigatória." }, { status: 422 });
    }
    const meetingDateError = validateMeetingDate(data.meetingDate);
    if (meetingDateError) {
      return NextResponse.json({ error: meetingDateError }, { status: 422 });
    }
    if (!data.r2Key || typeof data.r2Key !== "string" || !data.r2Key.trim()) {
      return NextResponse.json({ error: "Chave do arquivo no storage (r2Key) é obrigatória." }, { status: 422 });
    }
    if (!data.uploadToken || typeof data.uploadToken !== "string" || !data.uploadToken.trim()) {
      return NextResponse.json({ error: "Token de upload é obrigatório." }, { status: 422 });
    }
    if (!data.whatsappNumber || typeof data.whatsappNumber !== "string" || !data.whatsappNumber.trim()) {
      return NextResponse.json({ error: "Número de WhatsApp é obrigatório." }, { status: 422 });
    }
    const whatsappNumberError = getWhatsappNumberValidationError(data.whatsappNumber);
    if (whatsappNumberError) {
      return NextResponse.json({ error: whatsappNumberError }, { status: 422 });
    }
    const normalizedWhatsappNumber = normalizeWhatsappNumber(data.whatsappNumber);
    const requestedR2Key = data.r2Key.trim();
    const requestedUploadToken = data.uploadToken.trim();

    let uploadToken;
    try {
      uploadToken = verifyUploadToken(requestedUploadToken);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Token de upload inválido." },
        { status: 403 }
      );
    }

    if (uploadToken.userId !== auth.user.id || uploadToken.r2Key !== requestedR2Key) {
      return NextResponse.json({ error: "Upload não autorizado para este arquivo." }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data: existingMeeting, error: existingMeetingError } = await supabase
      .from("meetings")
      .select("id, status")
      .eq("user_id", auth.user.id)
      .eq("audio_r2_key", uploadToken.r2Key)
      .in("status", ["pending", "processing", "completed"])
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (existingMeetingError) {
      console.error("[meetings/process] existing meeting lookup error:", existingMeetingError);
      return NextResponse.json(
        { error: "Erro ao verificar reunião existente." },
        { status: 500 }
      );
    }

    if (existingMeeting) {
      return NextResponse.json(
        {
          meetingId: existingMeeting.id,
          status: existingMeeting.status as MeetingStatus,
        },
        { status: 200 }
      );
    }

    const { billingAccount, meetingsThisMonth, monthlyLimit } =
      await getBillingStatus(auth.user.id);

    if (monthlyLimit !== null && meetingsThisMonth >= monthlyLimit) {
      return NextResponse.json(
        {
          error:
            billingAccount.plan === "free"
              ? "Você atingiu o limite do plano Free. Faça upgrade para processar mais reuniões."
              : `Você atingiu o limite mensal do seu plano (${monthlyLimit} reuniões).`,
        },
        { status: 403 }
      );
    }

    const uploadMetadata = await getObjectMetadata(uploadToken.r2Key);
    if (!uploadMetadata) {
      return NextResponse.json(
        { error: "Upload não encontrado no storage. Reenvie o arquivo e tente novamente." },
        { status: 409 }
      );
    }

    if (
      !Number.isFinite(uploadMetadata.contentLength) ||
      uploadMetadata.contentLength === null ||
      uploadMetadata.contentLength <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Não foi possível validar o tamanho real do upload. Reenvie o arquivo e tente novamente.",
        },
        { status: 409 }
      );
    }

    if (uploadMetadata.contentLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande (${Math.round(uploadMetadata.contentLength / 1024 / 1024)}MB). O limite é 500MB.`,
        },
        { status: 413 }
      );
    }

    if (uploadMetadata.contentLength !== uploadToken.fileSize) {
      return NextResponse.json(
        {
          error:
            "Tamanho do upload não confere com o arquivo autorizado. Reenvie o arquivo e tente novamente.",
        },
        { status: 409 }
      );
    }

    // ── Insert meeting record ────────────────────────────────────────────────
    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert({
        user_id: auth.user.id,
        title: `Reunião — ${data.clientName.trim()}`,
        client_name: data.clientName.trim(),
        meeting_date: data.meetingDate,
        audio_r2_key: uploadToken.r2Key,
        whatsapp_number: normalizedWhatsappNumber,
        status: "pending" as MeetingStatus,
        whatsapp_status: "pending" as WhatsAppStatus,
        source: "upload" as MeetingSource,
      })
      .select("id")
      .single();

    if (insertError || !meeting) {
      console.error("[meetings/process] insert error:", insertError);
      return NextResponse.json({ error: "Erro ao registrar reunião no banco de dados." }, { status: 500 });
    }

    const queueSendStartedAt = Date.now();
    console.info("[meetings/process] queue send diagnostics:", {
      meetingId: meeting.id,
      userId: auth.user.id,
      nowEpochMs: queueSendStartedAt,
      nowIso: new Date(queueSendStartedAt).toISOString(),
    });

    // ── Enqueue Inngest processing job ───────────────────────────────────────
    try {
      await inngest.send({
        name: "meeting/process",
        data: {
          meetingId: meeting.id,
          r2Key: uploadToken.r2Key,
          whatsappNumber: normalizedWhatsappNumber,
          userId: auth.user.id,
        },
      });
    } catch (e) {
      console.error("[meetings/process] inngest send error:", e);
      const { error: markFailedError } = await supabase
        .from("meetings")
        .update({
          status: "failed" as MeetingStatus,
          error_message: "Falha ao enfileirar processamento da reunião.",
        })
        .eq("id", meeting.id);

      if (markFailedError) {
        console.error(
          "[meetings/process] failed to mark meeting as failed after queue error:",
          markFailedError
        );
      }

      return NextResponse.json(
        {
          error:
            "Houve um erro ao iniciar o processamento desta reunião. Tente processar novamente.",
        },
        { status: 503 }
      );
    }

    try {
      await syncMeetingsThisMonth(auth.user.id, meetingsThisMonth + 1);
    } catch (billingError) {
      console.error("[meetings/process] failed to sync billing usage:", billingError);
    }

    return NextResponse.json(
      { meetingId: meeting.id, status: "pending" as MeetingStatus },
      { status: 201 }
    );
  }
);
