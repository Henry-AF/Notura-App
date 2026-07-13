import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import {
  TASK_SELECT,
  buildTaskColumns,
  buildTaskMeetingOptions,
  mapTaskRowToBoardTask,
  normalizeTaskStatus,
  toDatabasePriority,
} from "./task-mapper";

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

export const GET = withAuth(async (request, { auth }) => {
  const url = new URL(request.url);
  const meetingId = url.searchParams.get("meetingId");
  const groupId = url.searchParams.get("groupId");

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (meetingId) query = query.eq("meeting_id", meetingId);
  if (groupId) query = query.eq("group_id", groupId);

  const { data: tasks, error } = await query;
  if (error) return NextResponse.json({ error: "Erro ao buscar tarefas." }, { status: 500 });

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, title, client_name")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (meetingsError) return NextResponse.json({ error: "Erro ao buscar reuniões." }, { status: 500 });

  return NextResponse.json({
    columns: buildTaskColumns(tasks ?? []),
    meetings: buildTaskMeetingOptions(meetings ?? []),
  });
});

export const POST = withAuth(async (request, { auth }) => {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 }); }

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
    typeof data.status === "string" ? data.status : "todo"
  );
  const isCompleted = taskStatus === "completed";

  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({
      meeting_id: meetingId,
      user_id: auth.user.id,
      dedupe_key: randomUUID(),
      description: data.description.trim(),
      priority: toDatabasePriority(typeof data.priority === "string" ? data.priority : "média"),
      owner: typeof data.owner === "string" ? data.owner : null,
      due_date: typeof data.due_date === "string" ? data.due_date : null,
      status: taskStatus,
      completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      source: "manual",
      group_id: typeof data.group_id === "string" ? data.group_id : null,
    })
    .select("id")
    .single();

  if (insertError || !task) {
    return NextResponse.json({ error: "Erro ao criar tarefa." }, { status: 500 });
  }

  const labelIds = Array.isArray(data.label_ids)
    ? (data.label_ids as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  if (labelIds.length > 0) await syncTaskLabels(supabase, task.id, labelIds);

  const { data: taskWithLabels } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", task.id)
    .single();

  if (!taskWithLabels) {
    return NextResponse.json({ error: "Erro ao recuperar tarefa criada." }, { status: 500 });
  }

  return NextResponse.json({ task: mapTaskRowToBoardTask(taskWithLabels) }, { status: 201 });
});
