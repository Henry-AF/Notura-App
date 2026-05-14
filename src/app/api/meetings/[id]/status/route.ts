import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";

function inferProcessingStep(status: string, currentStep: string | null | undefined) {
  if (currentStep) return currentStep;
  if (status === "completed") return "cleanup";
  if (status === "processing") return "transcribe";
  if (status === "pending") return "update-status-processing";
  return null;
}

export const GET = withAuth<{ id: string }>(async (
  _request: Request,
  { params, auth }
) => {
  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", params.id, auth.user.id);

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, title, status")
    .eq("id", params.id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json(
      { error: "Acesso negado." },
      { status: 403 }
    );
  }

  const [tasksResult, decisionsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", params.id),
    supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", params.id),
  ]);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("status, current_step, error_message")
    .eq("meeting_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tasksResult.error || decisionsResult.error || jobError) {
    console.error("[api/meetings/[id]/status] failed:", {
      tasksError: tasksResult.error,
      decisionsError: decisionsResult.error,
      jobError,
    });
    return NextResponse.json(
      { error: "Erro ao carregar status da reunião." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: meeting.id,
    title: meeting.title,
    status: meeting.status,
    processingStep: inferProcessingStep(meeting.status, job?.current_step),
    jobStatus: job?.status ?? null,
    errorMessage: job?.error_message ?? null,
    taskCount: tasksResult.count ?? 0,
    decisionCount: decisionsResult.count ?? 0,
  });
});
