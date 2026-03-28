// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meetings/upload — Accept audio file, store in R2, enqueue processing
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { buildR2Key, uploadAudio } from "@/lib/r2";
import { inngest } from "@/lib/inngest";
import { getBillingStatus, syncMeetingsThisMonth } from "@/lib/billing";
import type { MeetingStatus, MeetingSource, WhatsAppStatus } from "@/types/database";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabaseAuth = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado. Faça login para continuar." },
        { status: 401 }
      );
    }

    const { billingAccount, meetingsThisMonth, monthlyLimit } =
      await getBillingStatus(user.id);

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

    // ── Parse multipart form data ────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Requisição inválida. Envie um multipart/form-data com o campo 'audio'." },
        { status: 400 }
      );
    }

    const audioFile = formData.get("audio") as File | null;
    const clientName = (formData.get("client_name") as string | null) || null;
    const meetingDate = (formData.get("meeting_date") as string | null) || null;
    const whatsappNumber = formData.get("whatsapp_number") as string | null;

    // ── Validation ───────────────────────────────────────────────────────
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "Campo 'audio' é obrigatório. Envie um arquivo de áudio." },
        { status: 400 }
      );
    }

    if (!whatsappNumber || whatsappNumber.trim().length === 0) {
      return NextResponse.json(
        { error: "Campo 'whatsapp_number' é obrigatório." },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande (${Math.round(audioFile.size / 1024 / 1024)}MB). O limite é 500MB.`,
        },
        { status: 413 }
      );
    }

    const mimeType = audioFile.type || "";
    if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não suportado: '${mimeType}'. Envie um arquivo de áudio ou vídeo.`,
        },
        { status: 415 }
      );
    }

    // ── Upload to R2 ─────────────────────────────────────────────────────
    const r2Key = buildR2Key(user.id, audioFile.name);
    const fileBuffer = Buffer.from(await audioFile.arrayBuffer());
    await uploadAudio(r2Key, fileBuffer, mimeType);

    // ── Insert meeting record ────────────────────────────────────────────
    const supabase = createServiceRoleClient();

    const meetingInsert = {
      user_id: user.id,
      title: clientName ? `Reunião — ${clientName}` : "Nova reunião",
      client_name: clientName,
      meeting_date: meetingDate,
      audio_r2_key: r2Key,
      whatsapp_number: whatsappNumber.trim(),
      status: "pending" as MeetingStatus,
      whatsapp_status: "pending" as WhatsAppStatus,
      source: "upload" as MeetingSource,
    };

    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert(meetingInsert)
      .select("id")
      .single();

    if (insertError || !meeting) {
      console.error("[upload] Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Erro ao salvar reunião. Tente novamente." },
        { status: 500 }
      );
    }

    // ── Enqueue Inngest job ──────────────────────────────────────────────
    await inngest.send({
      name: "meeting/process",
      data: {
        meetingId: meeting.id,
        r2Key,
        whatsappNumber: whatsappNumber.trim(),
        userId: user.id,
      },
    });

    try {
      await syncMeetingsThisMonth(user.id, meetingsThisMonth + 1);
    } catch (billingError) {
      console.error("[upload] Failed to sync billing usage:", billingError);
    }

    // ── Response ─────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        meetingId: meeting.id,
        status: "pending" as MeetingStatus,
        estimatedMinutes: 3,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[upload] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor. Tente novamente." },
      { status: 500 }
    );
  }
}
