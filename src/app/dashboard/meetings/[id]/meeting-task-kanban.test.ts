import { describe, expect, it } from "vitest";
import type { MeetingTask } from "@/components/meeting-detail";
import {
  buildMeetingTaskColumns,
  mapBoardTaskToMeetingTask,
  setMeetingTaskCompletion,
  upsertMeetingTask,
} from "./meeting-task-kanban";

function makeTask(overrides: Partial<MeetingTask>): MeetingTask {
  return {
    id: "task-1",
    text: "Enviar proposta",
    completed: false,
    priority: "Média",
    ...overrides,
  };
}

describe("meeting task kanban helpers", () => {
  it("builds todo, in_progress and done columns from meeting tasks", () => {
    const tasks: MeetingTask[] = [
      makeTask({ id: "task-1", completed: false, priority: "Alta" }),
      makeTask({ id: "task-2", completed: true, priority: "Baixa" }),
    ];

    const columns = buildMeetingTaskColumns(tasks);

    expect(columns).toHaveLength(3);
    expect(columns[0]?.id).toBe("todo");
    expect(columns[1]?.id).toBe("in_progress");
    expect(columns[0]?.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-1",
          title: "Enviar proposta",
          priority: "alta",
          columnId: "todo",
        }),
      ])
    );
    expect(columns[2]?.id).toBe("done");
    expect(columns[2]?.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-2",
          priority: "baixa",
          columnId: "done",
        }),
      ])
    );
  });

  it("respects in-memory column placement for incomplete tasks", () => {
    const tasks: MeetingTask[] = [
      makeTask({ id: "task-1", completed: false }),
      makeTask({ id: "task-2", completed: false }),
    ];
    const columns = buildMeetingTaskColumns(tasks, {
      "task-2": "in_progress",
    });

    expect(columns[0]?.tasks).toHaveLength(1);
    expect(columns[0]?.tasks[0]?.id).toBe("task-1");
    expect(columns[1]?.tasks).toHaveLength(1);
    expect(columns[1]?.tasks[0]?.id).toBe("task-2");
  });

  it("updates completion state and completion label", () => {
    const tasks: MeetingTask[] = [makeTask({ id: "task-1", completed: false })];

    const completed = setMeetingTaskCompletion(
      tasks,
      "task-1",
      true,
      new Date("2026-04-08T12:00:00.000Z")
    );
    const reopened = setMeetingTaskCompletion(completed, "task-1", false);

    expect(completed[0]?.completed).toBe(true);
    expect(completed[0]?.completedLabel).toMatch(/Concluído/);
    expect(reopened[0]?.completed).toBe(false);
    expect(reopened[0]?.completedLabel).toBeUndefined();
  });

  it("maps board task payload to meeting task", () => {
    const mapped = mapBoardTaskToMeetingTask({
      id: "task-3",
      title: "Ligar para cliente",
      priority: "alta",
      columnId: "done",
      dueDate: "2026-04-10",
      completedDate: "Concluído em 10/04/2026",
      assignee: { name: "Carla" },
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        id: "task-3",
        text: "Ligar para cliente",
        completed: true,
        priority: "Alta",
        dueDate: "2026-04-10",
        completedLabel: "Concluído em 10/04/2026",
        assignee: "Carla",
      })
    );
  });

  it("upserts an existing meeting task", () => {
    const initial: MeetingTask[] = [
      makeTask({ id: "task-1", text: "Antiga", completed: false }),
      makeTask({ id: "task-2", text: "Outra", completed: false }),
    ];

    const next = upsertMeetingTask(
      initial,
      makeTask({ id: "task-1", text: "Atualizada", completed: true })
    );

    expect(next).toHaveLength(2);
    expect(next[0]?.text).toBe("Atualizada");
    expect(next[0]?.completed).toBe(true);
  });
});
