import type { Task, TaskLabel } from "@/components/tasks";
import { normalizeError, parseJson } from "@/lib/api-client";
import type { TaskMeetingOption } from "@/lib/tasks/task-mapper";

export type { TaskLabel };
export type { TaskMeetingOption };

interface TaskResponse {
  task?: Task;
  error?: string;
}

interface TaskLabelResponse {
  label?: TaskLabel;
  error?: string;
}

interface TaskLabelsResponse {
  labels?: TaskLabel[];
  error?: string;
}

export interface CreateTaskInput {
  title: string;
  priority: Task["priority"];
  columnId: string;
  meetingId: string;
  dueDate?: string;
  assigneeName?: string;
  groupId?: string;
  labelIds?: string[];
}

interface UpdateTaskInput {
  title?: string;
  priority?: Task["priority"];
  dueDate?: string;
  assigneeName?: string | null;
  status?: "todo" | "in_progress" | "completed";
  labelIds?: string[];
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_id: input.meetingId,
      description: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      owner: input.assigneeName,
      status: input.columnId === "completed" ? "completed" : input.columnId,
      group_id: input.groupId,
      label_ids: input.labelIds,
    }),
  });
  const body = await parseJson<TaskResponse>(response);
  if (!response.ok || !body.task) {
    throw new Error(normalizeError(body.error, "Erro ao criar tarefa."));
  }
  return body.task;
}

export async function updateTaskById(id: string, input: UpdateTaskInput): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      owner: input.assigneeName,
      status: input.status,
      label_ids: input.labelIds,
    }),
  });
  const body = await parseJson<TaskResponse>(response);
  if (!response.ok || !body.task) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar tarefa."));
  }
  return body.task;
}

export async function deleteTaskById(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (response.ok) return;
  const body = await parseJson<{ error?: string }>(response).catch((): { error?: string } => ({}));
  throw new Error(normalizeError(body.error, "Erro ao excluir tarefa."));
}

// ─── Task Labels ──────────────────────────────────────────────────────────────

export async function fetchTaskLabels(): Promise<TaskLabel[]> {
  const response = await fetch("/api/task-labels");
  const body = await parseJson<TaskLabelsResponse>(response);
  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar labels."));
  }
  return body.labels ?? [];
}

export async function createTaskLabel(name: string, color: string): Promise<TaskLabel> {
  const response = await fetch("/api/task-labels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  const body = await parseJson<TaskLabelResponse>(response);
  if (!response.ok || !body.label) {
    throw new Error(normalizeError(body.error, "Erro ao criar label."));
  }
  return body.label;
}

export async function deleteTaskLabel(id: string): Promise<void> {
  const response = await fetch(`/api/task-labels/${id}`, { method: "DELETE" });
  if (response.ok) return;
  const body = await parseJson<{ error?: string }>(response).catch((): { error?: string } => ({}));
  throw new Error(normalizeError(body.error, "Erro ao excluir label."));
}
