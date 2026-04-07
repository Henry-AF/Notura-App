import { beforeEach, describe, expect, it, vi } from "vitest";

describe("tasks api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches kanban columns from /api/tasks", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            columns: [
              { id: "todo", title: "A Fazer", dotColor: "#6C5CE7", badgeColor: "#A29BFE", badgeBg: "rgba(108,92,231,0.15)", tasks: [] },
              { id: "in_progress", title: "Em Andamento", dotColor: "#FFA94D", badgeColor: "#FFA94D", badgeBg: "rgba(255,169,77,0.15)", tasks: [] },
              { id: "done", title: "Concluído", dotColor: "#4ECB71", badgeColor: "#4ECB71", badgeBg: "rgba(78,203,113,0.15)", tasks: [] },
            ],
            meetings: [
              { id: "meeting-1", label: "Acme - Kickoff", title: "Kickoff", clientName: "Acme" },
            ],
          }),
          { status: 200 }
        )
      );

    const mod = await import("./tasks-api");
    const data = await mod.fetchTaskBoardData();

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", { method: "GET" });
    expect(data.columns).toHaveLength(3);
    expect(data.columns[1]?.id).toBe("in_progress");
    expect(data.meetings).toEqual([
      { id: "meeting-1", label: "Acme - Kickoff", title: "Kickoff", clientName: "Acme" },
    ]);
  });

  it("creates a task through /api/tasks and returns the created board task", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            task: {
              id: "task-uuid",
              title: "Enviar contrato",
              priority: "media",
              columnId: "todo",
              meetingId: "meeting-1",
              meetingSource: "Acme",
              dueDate: "2026-04-10",
              assignee: { name: "Ana" },
            },
          }),
          { status: 201 }
        )
      );

    const mod = await import("./tasks-api");
    const task = await mod.createTask({
      title: "Enviar contrato",
      priority: "media",
      columnId: "todo",
      meetingId: "meeting-1",
      dueDate: "2026-04-10",
      assigneeName: "Ana",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_id: "meeting-1",
        description: "Enviar contrato",
        priority: "media",
        due_date: "2026-04-10",
        owner: "Ana",
        completed: false,
      }),
    });
    expect(task).toEqual({
      id: "task-uuid",
      title: "Enviar contrato",
      priority: "media",
      columnId: "todo",
      meetingId: "meeting-1",
      meetingSource: "Acme",
      dueDate: "2026-04-10",
      assignee: { name: "Ana" },
    });
  });
});
