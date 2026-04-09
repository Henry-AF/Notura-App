import type { MeetingTask } from "@/components/meeting-detail";
import type { Column, Task } from "@/components/tasks";

export type MeetingTaskColumnId = "todo" | "in_progress" | "completed";

const COLUMN_DEFS: Omit<Column, "tasks">[] = [
  {
    id: "todo",
    title: "A Fazer",
    dotColor: "#6C5CE7",
    badgeColor: "#A29BFE",
    badgeBg: "rgba(108,92,231,0.15)",
  },
  {
    id: "in_progress",
    title: "Em andamento",
    dotColor: "#FFA94D",
    badgeColor: "#FFA94D",
    badgeBg: "rgba(255,169,77,0.15)",
  },
  {
    id: "completed",
    title: "Concluído",
    dotColor: "#4ECB71",
    badgeColor: "#4ECB71",
    badgeBg: "rgba(78,203,113,0.15)",
  },
];

function normalizeColumnId(value: string | undefined): MeetingTaskColumnId {
  if (value === "in_progress") return "in_progress";
  if (value === "completed" || value === "done") return "completed";
  return "todo";
}

function toBoardPriority(priority: MeetingTask["priority"]): Task["priority"] {
  if (priority === "Alta") return "alta";
  if (priority === "Média") return "media";
  return "baixa";
}

function toBoardTask(task: MeetingTask): Task {
  const columnId = normalizeColumnId(task.status ?? (task.completed ? "completed" : "todo"));
  return {
    id: task.id,
    title: task.text,
    priority: toBoardPriority(task.priority),
    columnId,
    dueDate: task.dueDate,
    completedDate: task.completedLabel,
    assignee: task.assignee ? { name: task.assignee } : undefined,
    assignees: task.assignee ? [{ name: task.assignee }] : undefined,
  };
}

function getTaskColumnId(
  task: MeetingTask,
  placementByTaskId: Record<string, MeetingTaskColumnId>
): MeetingTaskColumnId {
  const placement = placementByTaskId[task.id];
  if (placement) return normalizeColumnId(placement);
  return normalizeColumnId(task.status ?? (task.completed ? "completed" : "todo"));
}

function toMeetingPriority(priority: Task["priority"]): MeetingTask["priority"] {
  if (priority === "alta") return "Alta";
  if (priority === "media") return "Média";
  return "Baixa";
}

export function buildMeetingTaskColumns(
  tasks: MeetingTask[],
  placementByTaskId: Record<string, MeetingTaskColumnId> = {}
): Column[] {
  const todoTasks: Task[] = [];
  const inProgressTasks: Task[] = [];
  const completedTasks: Task[] = [];

  tasks.forEach((task) => {
    const boardTask = toBoardTask(task);
    const columnId = getTaskColumnId(task, placementByTaskId);
    boardTask.columnId = columnId;

    if (columnId === "completed") {
      completedTasks.push(boardTask);
      return;
    }

    if (columnId === "in_progress") {
      inProgressTasks.push(boardTask);
      return;
    }

    todoTasks.push(boardTask);
  });

  return [
    { ...COLUMN_DEFS[0], tasks: todoTasks },
    { ...COLUMN_DEFS[1], tasks: inProgressTasks },
    { ...COLUMN_DEFS[2], tasks: completedTasks },
  ];
}

function buildCompletedLabel(date: Date): string {
  const label = date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  return `Concluído ${label}`;
}

export function mapBoardTaskToMeetingTask(task: Task): MeetingTask {
  const assigneeName = task.assignees?.[0]?.name ?? task.assignee?.name;
  const status = normalizeColumnId(task.columnId);
  const completed = status === "completed";

  return {
    id: task.id,
    text: task.title,
    completed,
    status,
    assignee: assigneeName,
    priority: toMeetingPriority(task.priority),
    dueDate: task.dueDate,
    completedLabel: completed ? task.completedDate : undefined,
  };
}

export function upsertMeetingTask(
  tasks: MeetingTask[],
  updatedTask: MeetingTask
): MeetingTask[] {
  const idx = tasks.findIndex((task) => task.id === updatedTask.id);
  if (idx < 0) return [updatedTask, ...tasks];

  const next = [...tasks];
  next[idx] = updatedTask;
  return next;
}

export function setMeetingTaskCompletion(
  tasks: MeetingTask[],
  taskId: string,
  completed: boolean,
  now: Date = new Date()
): MeetingTask[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          completed,
          status: completed ? "completed" : "todo",
          completedLabel: completed ? buildCompletedLabel(now) : undefined,
        }
      : task
  );
}

export function setMeetingTaskStatus(
  tasks: MeetingTask[],
  taskId: string,
  status: MeetingTaskColumnId,
  now: Date = new Date()
): MeetingTask[] {
  const completed = status === "completed";
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status,
          completed,
          completedLabel: completed ? buildCompletedLabel(now) : undefined,
        }
      : task
  );
}
