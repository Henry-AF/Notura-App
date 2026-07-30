import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

// Mirrors the web app's task board endpoint (`GET /api/tasks`, backed by
// `src/lib/tasks/board.ts` / `task-mapper.ts`). MVP scope for the mobile
// slice (NOT-150): title, priority, status, due date, assignee name, and
// the originating meeting — no labels, no custom columns, no search/filters
// (those stay web-only for now, per product decision).

export type TaskStatus = "todo" | "in_progress" | "completed";
export type TaskPriority = "alta" | "media" | "baixa";

export interface TaskMeetingOption {
  id: string;
  label: string;
}

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  meetingId?: string;
  meetingSource?: string;
  dueDate?: string;
  assigneeName?: string;
}

export interface TaskBoard {
  tasks: Task[];
  meetings: TaskMeetingOption[];
}

interface TaskApiResponse {
  id: string;
  title: string;
  priority: TaskPriority;
  columnId: string;
  meetingId?: string;
  meetingSource?: string;
  dueDate?: string;
  assignee?: { name: string };
}

interface ColumnApiResponse {
  id: string;
  tasks: TaskApiResponse[];
}

interface MeetingOptionApiResponse {
  id: string;
  label: string;
}

interface TaskBoardApiResponse {
  columns?: ColumnApiResponse[];
  meetings?: MeetingOptionApiResponse[];
  error?: string;
}

interface TaskMutationApiResponse {
  task?: TaskApiResponse;
  error?: string;
}

function normalizeStatus(columnId: string): TaskStatus {
  if (columnId === "in_progress") return "in_progress";
  if (columnId === "completed") return "completed";
  return "todo";
}

function mapTask(task: TaskApiResponse): Task {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    status: normalizeStatus(task.columnId),
    meetingId: task.meetingId,
    meetingSource: task.meetingSource,
    dueDate: task.dueDate,
    assigneeName: task.assignee?.name,
  };
}

export async function fetchTaskBoard(): Promise<TaskBoard> {
  const response = await fetchApi("/api/tasks");
  const body = await parseJson<TaskBoardApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar tarefas."));
  }

  return {
    tasks: (body.columns ?? []).flatMap((column) => column.tasks.map(mapTask)),
    meetings: (body.meetings ?? []).map((meeting) => ({ id: meeting.id, label: meeting.label })),
  };
}

export interface CreateTaskInput {
  title: string;
  priority: TaskPriority;
  meetingId: string;
  status?: TaskStatus;
  dueDate?: string;
  assigneeName?: string;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const response = await fetchApi("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      meeting_id: input.meetingId,
      description: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      owner: input.assigneeName,
      status: input.status ?? "todo",
    }),
  });
  const body = await parseJson<TaskMutationApiResponse>(response);

  if (!response.ok || !body.task) {
    throw new Error(normalizeError(body.error, "Erro ao criar tarefa."));
  }

  return mapTask(body.task);
}

export interface UpdateTaskInput {
  title?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeName?: string;
  status?: TaskStatus;
}

// Note: the originating meeting is set at creation and immutable afterwards
// (mirrors web's `updateTaskById`, which never sends `meeting_id`).
export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const response = await fetchApi(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      description: input.title,
      priority: input.priority,
      due_date: input.dueDate,
      owner: input.assigneeName,
      status: input.status,
    }),
  });
  const body = await parseJson<TaskMutationApiResponse>(response);

  if (!response.ok || !body.task) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar tarefa."));
  }

  return mapTask(body.task);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetchApi(`/api/tasks/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Erro ao excluir tarefa.");
  }
}
