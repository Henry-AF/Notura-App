import { describe, expect, it } from "vitest";
import type { MeetingTask } from "@/components/meeting-detail";
import {
  buildMeetingTaskColumns,
  setMeetingTaskCompletion,
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
  it("builds todo and done columns from meeting tasks", () => {
    const tasks: MeetingTask[] = [
      makeTask({ id: "task-1", completed: false, priority: "Alta" }),
      makeTask({ id: "task-2", completed: true, priority: "Baixa" }),
    ];

    const columns = buildMeetingTaskColumns(tasks);

    expect(columns).toHaveLength(2);
    expect(columns[0]?.id).toBe("todo");
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
    expect(columns[1]?.id).toBe("done");
    expect(columns[1]?.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-2",
          priority: "baixa",
          columnId: "done",
        }),
      ])
    );
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
});
