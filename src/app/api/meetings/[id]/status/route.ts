import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";

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

  if (tasksResult.error || decisionsResult.error) {
    console.error("[api/meetings/[id]/status] failed:", {
      tasksError: tasksResult.error,
      decisionsError: decisionsResult.error,
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
    taskCount: tasksResult.count ?? 0,
    decisionCount: decisionsResult.count ?? 0,
  });
});
