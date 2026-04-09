import type { MeetingTask } from "@/components/meeting-detail";
import type { Column, Task } from "@/components/tasks";

export type MeetingTaskColumnId = "todo" | "in_progress" | "done";

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
    id: "done",
    title: "Concluído",
    dotColor: "#4ECB71",
    badgeColor: "#4ECB71",
    badgeBg: "rgba(78,203,113,0.15)",
  },
];

function toBoardPriority(priority: MeetingTask["priority"]): Task["priority"] {
  if (priority === "Alta") return "alta";
  if (priority === "Média") return "media";
  return "baixa";
}

function toBoardTask(task: MeetingTask): Task {
  return {
    id: task.id,
    title: task.text,
    priority: toBoardPriority(task.priority),
    columnId: task.completed ? "done" : "todo",
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
  if (task.completed) return "done";

  const placement = placementByTaskId[task.id];
  if (placement === "in_progress") return "in_progress";
  return "todo";
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
  const doneTasks: Task[] = [];

  tasks.forEach((task) => {
    const boardTask = toBoardTask(task);
    const columnId = getTaskColumnId(task, placementByTaskId);
    boardTask.columnId = columnId;

    if (columnId === "done") {
      doneTasks.push(boardTask);
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
    { ...COLUMN_DEFS[2], tasks: doneTasks },
  ];
}

function buildCompletedLabel(date: Date): string {
  const label = date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  return `Concluído ${label}`;
}

export function mapBoardTaskToMeetingTask(task: Task): MeetingTask {
  const assigneeName = task.assignees?.[0]?.name ?? task.assignee?.name;

  return {
    id: task.id,
    text: task.title,
    completed: task.columnId === "done",
    assignee: assigneeName,
    priority: toMeetingPriority(task.priority),
    dueDate: task.dueDate,
    completedLabel: task.completedDate,
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
          completedLabel: completed ? buildCompletedLabel(now) : undefined,
        }
      : task
  );
}
