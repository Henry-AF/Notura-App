import { describe, expect, it } from "vitest";
import { buildTaskColumns, mapTaskRowToBoardTask } from "./task-mapper";

describe("task mapper", () => {
  it("maps database status to board column ids", () => {
    const mapped = mapTaskRowToBoardTask({
      id: "task-1",
      meeting_id: "meeting-1",
      user_id: "user-1",
      dedupe_key: "dedupe-1",
      description: "Finalizar proposta",
      owner: "Ana",
      due_date: null,
      priority: "média",
      status: "completed",
      completed_at: "2026-04-09T10:00:00.000Z",
      created_at: "2026-04-09T09:00:00.000Z",
      meetings: { title: "Kickoff", client_name: "Acme" },
    } as never);

    expect(mapped.columnId).toBe("completed");
  });

  it("builds default columns using status values", () => {
    const cols = buildTaskColumns([
      {
        id: "task-1",
        meeting_id: "meeting-1",
        user_id: "user-1",
        dedupe_key: "dedupe-1",
        description: "Item todo",
        owner: null,
        due_date: null,
        priority: "alta",
        status: "todo",
        completed_at: null,
        created_at: "2026-04-09T09:00:00.000Z",
      },
      {
        id: "task-2",
        meeting_id: "meeting-1",
        user_id: "user-1",
        dedupe_key: "dedupe-2",
        description: "Item done",
        owner: null,
        due_date: null,
        priority: "baixa",
        status: "completed",
        completed_at: "2026-04-09T10:00:00.000Z",
        created_at: "2026-04-09T09:30:00.000Z",
      },
    ] as never);

    expect(cols.map((c) => c.id)).toEqual(["todo", "in_progress", "completed"]);
    expect(cols.find((c) => c.id === "completed")?.tasks).toHaveLength(1);
  });
});
