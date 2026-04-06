import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest";

// POST /api/meetings/:id/retry — Re-enqueue processing for a failed meeting
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Meeting ID obrigatório." }, { status: 400 });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabaseAuth = createServerSupabase();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // ── Fetch meeting with required processing fields ─────────────────────────
  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("id, user_id, audio_r2_key, whatsapp_number, status")
    .eq("id", id)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  if (meeting.user_id !== user.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // ── Only retry meetings that failed or are not yet processing ─────────────
  if (meeting.status === "processing") {
    return NextResponse.json({ error: "Reunião já está sendo processada." }, { status: 409 });
  }
  if (meeting.status === "completed") {
    return NextResponse.json({ error: "Reunião já foi processada com sucesso." }, { status: 409 });
  }

  if (!meeting.audio_r2_key) {
    return NextResponse.json({ error: "Arquivo de áudio não encontrado para esta reunião." }, { status: 422 });
  }

  // ── Reset status to pending ───────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("meetings")
    .update({ status: "pending", error_message: null })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Erro ao atualizar status da reunião." }, { status: 500 });
  }

  // ── Re-enqueue Inngest job ────────────────────────────────────────────────
  await inngest.send({
    name: "meeting/process",
    data: {
      meetingId: meeting.id,
      r2Key: meeting.audio_r2_key,
      whatsappNumber: meeting.whatsapp_number ?? "",
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true, meetingId: id }, { status: 200 });
}
