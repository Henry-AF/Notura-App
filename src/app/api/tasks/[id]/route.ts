import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { mapTaskRowToBoardTask, toDatabasePriority } from "../task-mapper";

// PATCH /api/tasks/:id — Update a task (ownership verified)
export const PATCH = withAuth<{ id: string }>(async (
  req: Request,
  { params, auth }
) => {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Task ID obrigatório." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "tasks", id, auth.user.id);

  const data = body as Record<string, unknown>;
  const updatePayload: Record<string, unknown> = {};

  if (typeof data.description === "string") updatePayload.description = data.description.trim();
  if (typeof data.priority === "string") updatePayload.priority = toDatabasePriority(data.priority);
  if (typeof data.owner === "string" || data.owner === null) updatePayload.owner = data.owner;
  if (typeof data.due_date === "string" || data.due_date === null) updatePayload.due_date = data.due_date;
  if (typeof data.completed === "boolean") {
    updatePayload.completed = data.completed;
    updatePayload.completed_at = data.completed ? new Date().toISOString() : null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", id)
    .select("id, meeting_id, user_id, dedupe_key, description, owner, due_date, priority, completed, completed_at, created_at, meetings(title, client_name)")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Erro ao atualizar tarefa." }, { status: 500 });
  }

  return NextResponse.json({ task: mapTaskRowToBoardTask(updated) }, { status: 200 });
});

// DELETE /api/tasks/:id — Delete a task (ownership verified)
export const DELETE = withAuth<{ id: string }>(async (
  _req: Request,
  { params, auth }
) => {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Task ID obrigatório." }, { status: 400 });
  }

  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "tasks", id, auth.user.id);

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Erro ao deletar tarefa." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
});
