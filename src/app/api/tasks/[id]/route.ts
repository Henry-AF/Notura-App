import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TASK_SELECT, buildUpdatePayload, mapTaskRowToBoardTask } from "@/lib/tasks/task-mapper";

async function syncTaskLabels(
  supabase: ReturnType<typeof createServiceRoleClient>,
  taskId: string,
  labelIds: string[]
) {
  await supabase.from("task_label_map").delete().eq("task_id", taskId);
  if (labelIds.length === 0) return;
  await supabase
    .from("task_label_map")
    .insert(labelIds.map((id) => ({ task_id: taskId, label_id: id })));
}

// PATCH /api/tasks/:id
export const PATCH = withAuth<{ id: string }>(async (req, { params, auth }) => {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Task ID obrigatório." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 }); }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  await requireOwnership(supabase, "tasks", id, auth.user.id);

  const data = body as Record<string, unknown>;
  const updatePayload = buildUpdatePayload(data);

  const { data: updated, error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", id)
    .select(TASK_SELECT)
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Erro ao atualizar tarefa." }, { status: 500 });
  }

  if (Array.isArray(data.label_ids)) {
    const labelIds = (data.label_ids as unknown[]).filter(
      (lid): lid is string => typeof lid === "string"
    );
    await syncTaskLabels(supabase, id, labelIds);
    const { data: refreshed } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).single();
    if (refreshed) return NextResponse.json({ task: mapTaskRowToBoardTask(refreshed) }, { status: 200 });
  }

  return NextResponse.json({ task: mapTaskRowToBoardTask(updated) }, { status: 200 });
});

// DELETE /api/tasks/:id
export const DELETE = withAuth<{ id: string }>(async (_req, { params, auth }) => {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Task ID obrigatório." }, { status: 400 });

  const supabase = createServiceRoleClient();
  await requireOwnership(supabase, "tasks", id, auth.user.id);

  const { error: deleteError } = await supabase.from("tasks").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: "Erro ao deletar tarefa." }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 200 });
});
