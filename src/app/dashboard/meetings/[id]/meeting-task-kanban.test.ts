import { describe, expect, it } from "vitest";
import {
  buildMeetingTaskColumns,
  mapBoardTaskToMeetingTask,
} from "./meeting-task-kanban";

describe("meeting task kanban mapper", () => {
  it("builds columns using task status (todo, in_progress, completed)", () => {
    const columns = buildMeetingTaskColumns([
      {
        id: "task-todo",
        text: "Tarefa 1",
        completed: false,
        status: "todo",
      },
      {
        id: "task-progress",
        text: "Tarefa 2",
        completed: false,
        status: "in_progress",
      },
      {
        id: "task-completed",
        text: "Tarefa 3",
        completed: true,
        status: "completed",
      },
    ]);

    expect(columns.map((c) => c.id)).toEqual(["todo", "in_progress", "completed"]);
    expect(columns.find((c) => c.id === "todo")?.tasks.map((t) => t.id)).toEqual([
      "task-todo",
    ]);
    expect(columns.find((c) => c.id === "in_progress")?.tasks.map((t) => t.id)).toEqual([
      "task-progress",
    ]);
    expect(columns.find((c) => c.id === "completed")?.tasks.map((t) => t.id)).toEqual([
      "task-completed",
    ]);
  });

  it("maps board task to meeting task preserving status", () => {
    const meetingTask = mapBoardTaskToMeetingTask({
      id: "task-1",
      title: "Enviar proposta",
      priority: "media",
      columnId: "in_progress",
      assignee: { name: "Ana" },
    });

    expect(meetingTask.status).toBe("in_progress");
    expect(meetingTask.completed).toBe(false);
  });
});
