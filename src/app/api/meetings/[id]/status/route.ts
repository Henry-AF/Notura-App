import { NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, title, status, user_id")
    .eq("id", params.id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json(
      { error: "Reunião não encontrada." },
      { status: 404 }
    );
  }

  if (meeting.user_id !== user.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
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
}
