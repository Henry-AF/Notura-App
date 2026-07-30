// Wraps the same `/api/tasks` endpoints the web dashboard already uses
// (`src/app/api/tasks/`, `src/lib/tasks/task-mapper.ts`) — no new backend
// contract. The web's `GET /api/tasks` groups tasks by status column
// (Kanban-shaped) so both mobile views come from a single fetch; this module
// flattens that back into a plain task list, since the mobile List view and
// the Kanban view both start from the same array.

import { fetchApi } from '@/lib/api/client';
import { normalizeError, parseJson } from '@/lib/api-client';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'alta' | 'media' | 'baixa';

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  meetingId?: string;
  meetingSource?: string;
  dueDate?: string;
  completedDate?: string;
  ownerName?: string;
  generatedByAI: boolean;
}

export interface TaskMeetingOption {
  id: string;
  title: string;
  clientName: string;
  label: string;
}

export interface TaskBoard {
  tasks: Task[];
  meetings: TaskMeetingOption[];
}

interface TaskApiShape {
  id: string;
  title: string;
  priority: TaskPriority;
  columnId: TaskStatus;
  meetingId?: string;
  meetingSource?: string;
  dueDate?: string;
  completedDate?: string;
  assignee?: { name: string };
  generatedByAI?: boolean;
}

interface TaskColumnApiShape {
  id: TaskStatus;
  tasks: TaskApiShape[];
}

interface TaskBoardApiResponse {
  columns?: TaskColumnApiShape[];
  meetings?: TaskMeetingOption[];
  error?: string;
}

interface TaskApiEnvelope {
  task?: TaskApiShape;
  error?: string;
}

function mapTask(raw: TaskApiShape): Task {
  return {
    id: raw.id,
    title: raw.title,
    priority: raw.priority,
    status: raw.columnId,
    meetingId: raw.meetingId,
    meetingSource: raw.meetingSource,
    dueDate: raw.dueDate,
    completedDate: raw.completedDate,
    ownerName: raw.assignee?.name,
    generatedByAI: raw.generatedByAI ?? false,
  };
}

export interface FetchTaskBoardOptions {
  meetingId?: string;
  groupId?: string;
}

export async function fetchTaskBoard(options: FetchTaskBoardOptions = {}): Promise<TaskBoard> {
  const searchParams = new URLSearchParams();
  if (options.meetingId) searchParams.set('meetingId', options.meetingId);
  if (options.groupId) searchParams.set('groupId', options.groupId);

  const query = searchParams.toString();
  const path = query ? `/api/tasks?${query}` : '/api/tasks';

  const response = await fetchApi(path);
  const body = await parseJson<TaskBoardApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, 'Erro ao carregar tarefas.'));
  }

  return {
    tasks: (body.columns ?? []).flatMap((column) => column.tasks.map(mapTask)),
    meetings: body.meetings ?? [],
  };
}

export interface CreateTaskInput {
  title: string;
  meetingId: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  owner?: string;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const response = await fetchApi('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      description: input.title,
      meeting_id: input.meetingId,
      priority: input.priority,
      status: input.status,
      due_date: input.dueDate,
      owner: input.owner,
    }),
  });
  const body = await parseJson<TaskApiEnvelope>(response);

  if (!response.ok || !body.task) {
    throw new Error(normalizeError(body.error, 'Erro ao criar tarefa.'));
  }
  return mapTask(body.task);
}

// `meeting_id` is intentionally absent here — the web's PATCH route
// (`src/lib/tasks/task-mapper.ts`, `buildUpdatePayload`) never accepts it,
// so an existing task's linked meeting cannot be changed after creation.
export interface UpdateTaskInput {
  title?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  owner?: string | null;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const response = await fetchApi(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      description: input.title,
      priority: input.priority,
      status: input.status,
      due_date: input.dueDate,
      owner: input.owner,
    }),
  });
  const body = await parseJson<TaskApiEnvelope>(response);

  if (!response.ok || !body.task) {
    throw new Error(normalizeError(body.error, 'Erro ao atualizar tarefa.'));
  }
  return mapTask(body.task);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetchApi(`/api/tasks/${id}`, { method: 'DELETE' });
  const body = await parseJson<{ success?: boolean; error?: string }>(response);

  if (!response.ok || !body.success) {
    throw new Error(normalizeError(body.error, 'Erro ao excluir tarefa.'));
  }
}
