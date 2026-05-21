import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";

const USER_CANCELED_PROCESSING_MESSAGE = "Processamento cancelado pelo usuário.";
const CANCELABLE_MEETING_STATUSES = ["pending", "processing"];
const ACTIVE_JOB_STATUSES = ["queued", "processing"];

function isCancelableMeetingStatus(status: string): boolean {
  return CANCELABLE_MEETING_STATUSES.includes(status);
}

export const POST = withAuth<{ id: string }>(async (
  _request: Request,
  { params, auth }
) => {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Meeting ID obrigatório." }, { status: 400 });
  }

  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", id, auth.user.id);

  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("id, status")
    .eq("id", id)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!isCancelableMeetingStatus(meeting.status)) {
    return NextResponse.json(
      { error: "Somente reuniões em processamento podem ser canceladas." },
      { status: 409 }
    );
  }

  const { error: meetingUpdateError } = await supabase
    .from("meetings")
    .update({
      status: "failed",
      error_message: USER_CANCELED_PROCESSING_MESSAGE,
    })
    .eq("id", id);

  if (meetingUpdateError) {
    return NextResponse.json(
      { error: "Erro ao cancelar processamento da reunião." },
      { status: 500 }
    );
  }

  const { error: jobUpdateError } = await supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message: USER_CANCELED_PROCESSING_MESSAGE,
      completed_at: new Date().toISOString(),
    })
    .eq("meeting_id", id)
    .in("status", ACTIVE_JOB_STATUSES);

  if (jobUpdateError) {
    console.warn("[meetings/cancel-processing] failed to update active jobs:", jobUpdateError);
  }

  return NextResponse.json(
    { success: true, meetingId: id, status: "failed" },
    { status: 200 }
  );
});
