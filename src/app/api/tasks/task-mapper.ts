import type { Column, Task, TaskLabel } from "@/components/tasks";
import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"] & {
  meetings?: { title: string | null; client_name: string | null } | null;
  task_label_map?: Array<{
    label_id: string;
    task_labels: { id: string; name: string; color: string } | null;
  }> | null;
};

// Exported so route files can reference the same SELECT without duplication
export const TASK_SELECT =
  "id, meeting_id, user_id, dedupe_key, description, owner, due_date, priority, status, completed, completed_at, created_at, source, group_id, meetings(title, client_name), task_label_map(label_id, task_labels(id, name, color))";

const COLUMN_DEFS: Omit<Column, "tasks">[] = [
  { id: "todo",        title: "A Fazer",       dotColor: "#6C5CE7", badgeColor: "#A29BFE", badgeBg: "rgba(108,92,231,0.15)" },
  { id: "in_progress", title: "Em Andamento",  dotColor: "#FFA94D", badgeColor: "#FFA94D", badgeBg: "rgba(255,169,77,0.15)"  },
  { id: "completed",   title: "Concluído",     dotColor: "#4ECB71", badgeColor: "#4ECB71", badgeBg: "rgba(78,203,113,0.15)" },
];

export function normalizeTaskPriority(
  priority: string | null | undefined
): Task["priority"] {
  const lower = (priority ?? "").trim().toLowerCase();
  if (lower === "alta") return "alta";
  if (lower === "media" || lower === "média") return "media";
  return "baixa";
}

export function toDatabasePriority(
  priority: string | null | undefined
): "alta" | "média" | "baixa" | undefined {
  const normalized = normalizeTaskPriority(priority);
  if (normalized === "alta") return "alta";
  if (normalized === "media") return "média";
  return "baixa";
}

export function normalizeTaskStatus(
  status: string | null | undefined
): "todo" | "in_progress" | "completed" {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "in_progress" || normalized === "in progress") return "in_progress";
  if (normalized === "completed" || normalized === "done") return "completed";
  return "todo";
}

function resolveTaskColumnId(task: TaskRow): "todo" | "in_progress" | "completed" {
  if (typeof task.status === "string" && task.status.trim()) {
    return normalizeTaskStatus(task.status);
  }
  return task.completed ? "completed" : "todo";
}

export function mapTaskRowToBoardTask(task: TaskRow): Task {
  const meetingSource = task.meetings?.client_name ?? task.meetings?.title ?? undefined;
  const labels: TaskLabel[] = (task.task_label_map ?? [])
    .flatMap((m) => (m.task_labels ? [m.task_labels] : []));

  return {
    id: task.id,
    title: task.description,
    priority: normalizeTaskPriority(task.priority),
    columnId: resolveTaskColumnId(task),
    meetingId: task.meeting_id,
    groupId: task.group_id ?? undefined,
    source: task.source ?? "manual",
    dueDate: task.due_date ?? undefined,
    completedDate: task.completed_at
      ? `Concluído em ${new Date(task.completed_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`
      : undefined,
    assignee: task.owner ? { name: task.owner } : undefined,
    assignees: task.owner ? [{ name: task.owner }] : undefined,
    meetingSource,
    generatedByAI: task.source === "ai_extracted",
    labels,
  };
}

export function buildTaskColumns(tasks: TaskRow[]): Column[] {
  const validIds = new Set(COLUMN_DEFS.map((c) => c.id));
  const colMap = new Map<string, Task[]>();

  for (const task of tasks) {
    const colId = resolveTaskColumnId(task);
    const key = validIds.has(colId) ? colId : "todo";
    const existing = colMap.get(key) ?? [];
    existing.push(mapTaskRowToBoardTask(task));
    colMap.set(key, existing);
  }

  return COLUMN_DEFS.map((def) => ({ ...def, tasks: colMap.get(def.id) ?? [] }));
}

export function buildTaskMeetingOptions(
  meetings: Array<{ id: string; title: string | null; client_name: string | null }>
) {
  return meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title ?? "Reunião",
    clientName: meeting.client_name ?? "Sem cliente",
    label: `${meeting.client_name ?? "Sem cliente"} - ${meeting.title ?? "Reunião"}`,
  }));
}
