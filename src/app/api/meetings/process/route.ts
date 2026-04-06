import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest";
import type { MeetingStatus, MeetingSource, WhatsAppStatus } from "@/types/database";

// ─── POST /api/meetings/process ───────────────────────────────────────────────
// Registers a meeting record for an already-uploaded audio file and enqueues
// processing. Expects the R2 key from a prior upload step.

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const supabaseAuth = createServerSupabase();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

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
  if (!data.r2Key || typeof data.r2Key !== "string" || !data.r2Key.trim()) {
    return NextResponse.json({ error: "Chave do arquivo no storage (r2Key) é obrigatória." }, { status: 422 });
  }
  if (!data.whatsappNumber || typeof data.whatsappNumber !== "string" || !data.whatsappNumber.trim()) {
    return NextResponse.json({ error: "Número de WhatsApp é obrigatório." }, { status: 422 });
  }

  const supabase = createServiceRoleClient();

  // ── Insert meeting record ────────────────────────────────────────────────
  const { data: meeting, error: insertError } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      title: `Reunião — ${data.clientName.trim()}`,
      client_name: data.clientName.trim(),
      meeting_date: data.meetingDate,
      audio_r2_key: data.r2Key.trim(),
      whatsapp_number: data.whatsappNumber.trim(),
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

  // ── Enqueue Inngest processing job ───────────────────────────────────────
  try {
    await inngest.send({
      name: "meeting/process",
      data: {
        meetingId: meeting.id,
        r2Key: data.r2Key.trim(),
        whatsappNumber: data.whatsappNumber.trim(),
        userId: user.id,
      },
    });
  } catch (e) {
    console.error("[meetings/process] inngest send error:", e);
    // Meeting is already created — return success so the client can poll status
    return NextResponse.json(
      { meetingId: meeting.id, status: "pending" as MeetingStatus, warning: "Fila de processamento indisponível." },
      { status: 201 }
    );
  }

  return NextResponse.json(
    { meetingId: meeting.id, status: "pending" as MeetingStatus },
    { status: 201 }
  );
}
