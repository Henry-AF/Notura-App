import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import {
  buildTaskColumns,
  buildTaskMeetingOptions,
  mapTaskRowToBoardTask,
  normalizeTaskStatus,
  toDatabasePriority,
} from "./task-mapper";

export const GET = withAuth(async (_request, { auth }) => {
  const supabase = createServiceRoleClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, meeting_id, user_id, dedupe_key, description, owner, due_date, priority, status, completed, completed_at, created_at, meetings(title, client_name)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar tarefas." }, { status: 500 });
  }

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, title, client_name")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (meetingsError) {
    return NextResponse.json({ error: "Erro ao buscar reuniões." }, { status: 500 });
  }

  return NextResponse.json({
    columns: buildTaskColumns(tasks ?? []),
    meetings: buildTaskMeetingOptions(meetings ?? []),
  });
});

export const POST = withAuth(async (request, { auth }) => {
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

  const meetingId = data.meeting_id.trim();

  await requireOwnership(supabase, "meetings", meetingId, auth.user.id);

  const taskStatus = normalizeTaskStatus(
    typeof data.status === "string"
      ? data.status
      : typeof data.kanban_status === "string"
      ? data.kanban_status
      : typeof data.completed === "boolean"
      ? (data.completed ? "completed" : "todo")
      : "todo"
  );
  const isCompleted = taskStatus === "completed";

  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({
      meeting_id: meetingId,
      user_id: auth.user.id,
      dedupe_key: randomUUID(),
      description: data.description.trim(),
      priority: toDatabasePriority(
        typeof data.priority === "string" ? data.priority : "média"
      ),
      owner: typeof data.owner === "string" ? data.owner : null,
      due_date: typeof data.due_date === "string" ? data.due_date : null,
      status: taskStatus,
      completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .select("id, meeting_id, user_id, dedupe_key, description, owner, due_date, priority, status, completed, completed_at, created_at, meetings(title, client_name)")
    .single();

  if (insertError || !task) {
    return NextResponse.json({ error: "Erro ao criar tarefa." }, { status: 500 });
  }

  return NextResponse.json(
    { task: mapTaskRowToBoardTask(task) },
    { status: 201 }
  );
});
