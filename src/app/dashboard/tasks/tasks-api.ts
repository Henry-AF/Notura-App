import type { Column, Task } from "@/components/tasks";

export interface TaskMeetingOption {
  id: string;
  title: string;
  clientName: string;
  label: string;
}

interface TaskColumnsResponse {
  columns?: Column[];
  meetings?: TaskMeetingOption[];
  error?: string;
}

interface TaskResponse {
  task?: Task;
  error?: string;
}

interface CreateTaskInput {
  title: string;
  priority: Task["priority"];
  columnId: string;
  meetingId: string;
  dueDate?: string;
  assigneeName?: string;
}

interface UpdateTaskInput {
  title?: string;
  priority?: Task["priority"];
  dueDate?: string;
  assigneeName?: string | null;
  completed?: boolean;
  kanbanStatus?: string;
}

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function fetchTaskColumns(): Promise<Column[]> {
  const data = await fetchTaskBoardData();
  return data.columns;
}

export async function fetchTaskBoardData(): Promise<{
  columns: Column[];
  meetings: TaskMeetingOption[];
}> {
  const response = await fetch("/api/tasks", { method: "GET" });
  const body = await parseJson<TaskColumnsResponse>(response);

  if (!response.ok || !body.columns) {
    throw new Error(body.error ?? "Erro ao carregar tarefas.");
  }

  return {
    columns: body.columns,
    meetings: body.meetings ?? [],
  };
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
      completed: input.columnId === "done",
      kanban_status: input.columnId,
    }),
  });
  const body = await parseJson<TaskResponse>(response);

  if (!response.ok || !body.task) {
    throw new Error(body.error ?? "Erro ao criar tarefa.");
  }

  return body.task;
}

export async function updateTaskById(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      owner: input.assigneeName,
      completed: input.completed,
      kanban_status: input.kanbanStatus,
    }),
  });
  const body = await parseJson<TaskResponse>(response);

  if (!response.ok || !body.task) {
    throw new Error(body.error ?? "Erro ao atualizar tarefa.");
  }

  return body.task;
}

export async function deleteTaskById(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });

  if (response.ok) return;

  const body = await parseJson<{ error?: string }>(response).catch(
    (): { error?: string } => ({})
  );
  throw new Error(normalizeError(body.error, "Erro ao excluir tarefa."));
}
