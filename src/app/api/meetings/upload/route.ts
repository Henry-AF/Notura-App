// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meetings/upload — Accept audio file, store in R2, enqueue processing
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { buildR2Key, uploadAudio } from "@/lib/r2";
import { inngest } from "@/lib/inngest";
import { getBillingStatus, syncMeetingsThisMonth } from "@/lib/billing";
import type { MeetingStatus, MeetingSource, WhatsAppStatus } from "@/types/database";

// Remove the default 4 MB body-size limit so large audio files can be uploaded.
export const config = {
  api: { bodyParser: false },
};

// Allow up to 5 minutes for large uploads on serverless/edge.
export const maxDuration = 300;

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

const isDev = process.env.NODE_ENV === "development";

function serverError(message: string, detail: unknown, status = 500) {
  const err = detail instanceof Error ? detail : new Error(String(detail));
  console.error(`[upload] ${message}`, err.stack ?? err);
  return NextResponse.json(
    {
      error: message,
      ...(isDev && { detail: err.message, stack: err.stack }),
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  let user: Awaited<ReturnType<ReturnType<typeof createServerSupabase>["auth"]["getUser"]>>["data"]["user"];
  try {
    const supabaseAuth = createServerSupabase();
    const { data, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json(
        { error: "Não autenticado. Faça login para continuar." },
        { status: 401 }
      );
    }
    user = data.user;
  } catch (e) {
    return serverError("Falha ao verificar autenticação.", e, 500);
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

  console.log("[upload] arquivo:", audioFile?.name, audioFile?.size, audioFile?.type);

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
      { error: `Arquivo muito grande (${Math.round(audioFile.size / 1024 / 1024)}MB). O limite é 500MB.` },
      { status: 413 }
    );
  }

  const mimeType = audioFile.type || "";
  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: `Tipo de arquivo não suportado: '${mimeType}'. Envie um arquivo de áudio ou vídeo.` },
      { status: 415 }
    );
  }

  // ── Upload to R2 ─────────────────────────────────────────────────────
  const r2Key = buildR2Key(user.id, audioFile.name);
  let fileBuffer: Buffer;
  try {
    console.log("[upload] lendo buffer do arquivo…");
    fileBuffer = Buffer.from(await audioFile.arrayBuffer());
    console.log("[upload] buffer pronto, tamanho:", fileBuffer.byteLength);
  } catch (e) {
    return serverError("Falha ao ler o arquivo em memória.", e);
  }

  try {
    console.log("[upload] enviando para R2, key:", r2Key);
    await uploadAudio(r2Key, fileBuffer, mimeType);
    console.log("[upload] R2 upload concluído.");
  } catch (e) {
    return serverError("Falha ao enviar arquivo para o Cloudflare R2.", e);
  }

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

  let meeting: { id: string };
  try {
    console.log("[upload] inserindo reunião no Supabase…");
    const { data, error: insertError } = await supabase
      .from("meetings")
      .insert(meetingInsert)
      .select("id")
      .single();

    if (insertError || !data) {
      return serverError("Erro ao salvar reunião no banco de dados.", insertError ?? new Error("no data"));
    }
    meeting = data as { id: string };
    console.log("[upload] reunião criada:", meeting.id);
  } catch (e) {
    return serverError("Falha na comunicação com o Supabase (insert).", e);
  }

  // ── Enqueue Inngest job ──────────────────────────────────────────────
  try {
    console.log("[upload] enfileirando job Inngest…");
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

  // ── Response ─────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      meetingId: meeting.id,
      status: "pending" as MeetingStatus,
      estimatedMinutes: 3,
    },
    { status: 201 }
  );
}
