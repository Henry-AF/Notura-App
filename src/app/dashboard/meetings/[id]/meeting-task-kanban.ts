import type { MeetingTask } from "@/components/meeting-detail";
import type { Column, Task } from "@/components/tasks";

const COLUMN_DEFS: Omit<Column, "tasks">[] = [
  {
    id: "todo",
    title: "A Fazer",
    dotColor: "#6C5CE7",
    badgeColor: "#A29BFE",
    badgeBg: "rgba(108,92,231,0.15)",
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

export function buildMeetingTaskColumns(tasks: MeetingTask[]): Column[] {
  const todoTasks = tasks.filter((task) => !task.completed).map(toBoardTask);
  const doneTasks = tasks.filter((task) => task.completed).map(toBoardTask);

  return [
    { ...COLUMN_DEFS[0], tasks: todoTasks },
    { ...COLUMN_DEFS[1], tasks: doneTasks },
  ];
}

function buildCompletedLabel(date: Date): string {
  const label = date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  return `Concluído ${label}`;
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
