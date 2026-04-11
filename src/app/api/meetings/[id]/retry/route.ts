import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { inngest } from "@/lib/inngest";

// POST /api/meetings/:id/retry — Re-enqueue processing for a failed meeting
export const POST = withAuth<{ id: string }>(async (
  _req: Request,
  { params, auth }
) => {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Meeting ID obrigatório." }, { status: 400 });
  }

  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", id, auth.user.id);

  // ── Fetch meeting with required processing fields ─────────────────────────
  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("id, user_id, audio_r2_key, whatsapp_number, status")
    .eq("id", id)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // ── Only retry failed meetings to avoid duplicate queueing ─────────────────
  if (meeting.status !== "failed") {
    return NextResponse.json(
      { error: "Somente reuniões com falha podem ser reprocessadas manualmente." },
      { status: 409 }
    );
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
      userId: auth.user.id,
    },
  });

  return NextResponse.json({ success: true, meetingId: id }, { status: 200 });
});
