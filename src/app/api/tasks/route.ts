import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

// GET /api/tasks — Return authenticated user's tasks as kanban columns
export async function GET() {
  const supabaseAuth = createServerSupabase();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, description, owner, due_date, priority, completed, completed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar tarefas." }, { status: 500 });
  }

  const todo = (tasks ?? []).filter((t) => !t.completed);
  const done = (tasks ?? []).filter((t) => t.completed);

  const columns = [
    {
      id: "todo",
      title: "A Fazer",
      dotColor: "#6C5CE7",
      badgeColor: "#A29BFE",
      badgeBg: "rgba(108,92,231,0.15)",
      tasks: todo.map((t) => ({
        id: t.id,
        title: t.description,
        priority: normalizePriority(t.priority),
        columnId: "todo",
        dueDate: t.due_date ?? undefined,
        assignee: t.owner ? { name: t.owner } : undefined,
      })),
    },
    {
      id: "done",
      title: "Concluído",
      dotColor: "#4ECB71",
      badgeColor: "#4ECB71",
      badgeBg: "rgba(78,203,113,0.15)",
      tasks: done.map((t) => ({
        id: t.id,
        title: t.description,
        priority: normalizePriority(t.priority),
        columnId: "done",
        completedDate: t.completed_at
          ? new Date(t.completed_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
          : undefined,
        assignee: t.owner ? { name: t.owner } : undefined,
      })),
    },
  ];

  return NextResponse.json({ columns });
}

function normalizePriority(p: string | null): "alta" | "media" | "baixa" {
  const lower = (p ?? "").toLowerCase();
  if (lower === "alta") return "alta";
  if (lower === "media" || lower === "média") return "media";
  return "baixa";
}

// POST /api/tasks — Create a task linked to a meeting
export async function POST(request: Request) {
  const supabaseAuth = createServerSupabase();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  if (!data.description || typeof data.description !== "string" || !data.description.trim()) {
    return NextResponse.json({ error: "Campo 'description' (string) é obrigatório." }, { status: 400 });
  }
  if (!data.meeting_id || typeof data.meeting_id !== "string") {
    return NextResponse.json({ error: "Campo 'meeting_id' é obrigatório." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Verify the meeting belongs to the authenticated user
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, user_id")
    .eq("id", data.meeting_id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
  }
  if (meeting.user_id !== user.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({
      meeting_id: data.meeting_id,
      user_id: user.id,
      dedupe_key: randomUUID(),
      description: data.description.trim(),
      priority: typeof data.priority === "string" ? data.priority : "média",
      owner: typeof data.owner === "string" ? data.owner : null,
      due_date: typeof data.due_date === "string" ? data.due_date : null,
    })
    .select()
    .single();

  if (insertError || !task) {
    return NextResponse.json({ error: "Erro ao criar tarefa." }, { status: 500 });
  }

  return NextResponse.json({ task }, { status: 201 });
}
