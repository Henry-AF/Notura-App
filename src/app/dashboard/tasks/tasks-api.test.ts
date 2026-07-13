import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);
  Object.defineProperty(globalThis, "location", {
    value: { origin: "http://localhost:3000" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// ─── fetchTaskBoardData ───────────────────────────────────────────────────────

describe("fetchTaskBoardData", () => {
  it("returns columns and meetings on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        columns: [{ id: "todo", title: "A Fazer", tasks: [] }],
        meetings: [{ id: "m1", title: "Kickoff", clientName: "Acme", label: "Acme - Kickoff" }],
      }),
    });

    const { fetchTaskBoardData } = await import("./tasks-api");
    const result = await fetchTaskBoardData();

    expect(result.columns).toHaveLength(1);
    expect(result.meetings).toHaveLength(1);
  });

  it("forwards meetingId and groupId as query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ columns: [], meetings: [] }),
    });

    const { fetchTaskBoardData } = await import("./tasks-api");
    await fetchTaskBoardData({ meetingId: "m1", groupId: "g1" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("meetingId=m1");
    expect(calledUrl).toContain("groupId=g1");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Erro ao carregar tarefas." }),
    });

    const { fetchTaskBoardData } = await import("./tasks-api");
    await expect(fetchTaskBoardData()).rejects.toThrow("Erro ao carregar tarefas.");
  });
});

// ─── createTask ───────────────────────────────────────────────────────────────

describe("createTask", () => {
  it("posts to /api/tasks and returns the created task", async () => {
    const fakeTask = { id: "t1", title: "Nova tarefa", priority: "media", columnId: "todo" };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ task: fakeTask }),
    });

    const { createTask } = await import("./tasks-api");
    const result = await createTask({
      title: "Nova tarefa",
      priority: "media",
      columnId: "todo",
      meetingId: "m1",
    });

    expect(result).toEqual(fakeTask);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes labelIds in the request body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ task: { id: "t1", title: "T", priority: "alta", columnId: "todo" } }),
    });

    const { createTask } = await import("./tasks-api");
    await createTask({
      title: "T",
      priority: "alta",
      columnId: "todo",
      meetingId: "m1",
      labelIds: ["label-1"],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.label_ids).toEqual(["label-1"]);
  });
});

// ─── updateTaskById ───────────────────────────────────────────────────────────

describe("updateTaskById", () => {
  it("patches task and returns updated task", async () => {
    const updated = { id: "t1", title: "Updated", priority: "alta", columnId: "in_progress" };
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ task: updated }) });

    const { updateTaskById } = await import("./tasks-api");
    const result = await updateTaskById("t1", { title: "Updated", priority: "alta" });

    expect(result).toEqual(updated);
  });
});

// ─── deleteTaskById ───────────────────────────────────────────────────────────

describe("deleteTaskById", () => {
  it("resolves on 200", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const { deleteTaskById } = await import("./tasks-api");
    await expect(deleteTaskById("t1")).resolves.toBeUndefined();
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Erro ao excluir tarefa." }) });

    const { deleteTaskById } = await import("./tasks-api");
    await expect(deleteTaskById("t1")).rejects.toThrow("Erro ao excluir tarefa.");
  });
});

// ─── fetchTaskLabels ──────────────────────────────────────────────────────────

describe("fetchTaskLabels", () => {
  it("returns list of labels", async () => {
    const fakeLabels = [{ id: "l1", name: "Bug", color: "#FF6B6B", created_at: "2026-01-01" }];
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ labels: fakeLabels }) });

    const { fetchTaskLabels } = await import("./tasks-api");
    const result = await fetchTaskLabels();

    expect(result).toEqual(fakeLabels);
  });
});

// ─── createTaskLabel ──────────────────────────────────────────────────────────

describe("createTaskLabel", () => {
  it("posts name and color, returns new label", async () => {
    const newLabel = { id: "l2", name: "Feature", color: "#6C5CE7", created_at: "2026-01-02" };
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ label: newLabel }) });

    const { createTaskLabel } = await import("./tasks-api");
    const result = await createTaskLabel("Feature", "#6C5CE7");

    expect(result).toEqual(newLabel);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).toEqual({ name: "Feature", color: "#6C5CE7" });
  });
});

// ─── deleteTaskLabel ──────────────────────────────────────────────────────────

describe("deleteTaskLabel", () => {
  it("resolves on success", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const { deleteTaskLabel } = await import("./tasks-api");
    await expect(deleteTaskLabel("l1")).resolves.toBeUndefined();
  });
});
