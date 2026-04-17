import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { inngest } from "@/lib/inngest";

interface RetryMeeting {
  id: string;
  audio_r2_key: string | null;
  whatsapp_number: string | null;
  status: string;
}

function isAlreadyQueuedStatus(status: string): boolean {
  return status === "pending" || status === "processing";
}

function alreadyQueuedResponse(meetingId: string): NextResponse {
  return NextResponse.json(
    { success: true, meetingId, idempotent: true, alreadyQueued: true },
    { status: 200 }
  );
}

async function enqueueRetry(
  meeting: RetryMeeting,
  userId: string
): Promise<void> {
  await inngest.send({
    name: "meeting/process",
    data: {
      meetingId: meeting.id,
      r2Key: meeting.audio_r2_key,
      whatsappNumber: meeting.whatsapp_number ?? "",
      userId,
    },
  });
}

// POST /api/meetings/:id/retry — Re-enqueue processing for a failed meeting
export const POST = withAuth<{ id: string }>(async (
  _req: Request,
  { params, auth }
) => {
  const meetingId = params.id;
  if (!meetingId) {
    return NextResponse.json({ error: "Meeting ID obrigatório." }, { status: 400 });
  }

  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", meetingId, auth.user.id);

  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("id, audio_r2_key, whatsapp_number, status")
    .eq("id", meetingId)
    .single<RetryMeeting>();

  if (fetchError) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (isAlreadyQueuedStatus(meeting.status)) {
    return alreadyQueuedResponse(meetingId);
  }

  if (meeting.status !== "failed") {
    return NextResponse.json(
      { error: "Somente reuniões com falha podem ser reprocessadas manualmente." },
      { status: 409 }
    );
  }

  if (!meeting.audio_r2_key) {
    return NextResponse.json(
      { error: "Arquivo de áudio não encontrado para esta reunião." },
      { status: 422 }
    );
  }

  const { data: claimedMeeting, error: claimError } = await supabase
    .from("meetings")
    .update({ status: "pending", error_message: null })
    .eq("id", meetingId)
    .eq("status", "failed")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (claimError) {
    return NextResponse.json(
      { error: "Erro ao atualizar status da reunião." },
      { status: 500 }
    );
  }

  if (!claimedMeeting) {
    return alreadyQueuedResponse(meetingId);
  }

  try {
    await enqueueRetry(meeting, auth.user.id);
  } catch (error) {
    console.error("[meetings/retry] Failed to enqueue processing job", error);

    await supabase
      .from("meetings")
      .update({
        status: "failed",
        error_message: "Falha ao enfileirar reprocessamento.",
      })
      .eq("id", meetingId)
      .eq("status", "pending");

    return NextResponse.json(
      { error: "Erro ao enviar reunião para reprocessamento." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, meetingId }, { status: 200 });
});
