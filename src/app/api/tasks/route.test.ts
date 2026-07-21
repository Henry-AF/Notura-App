import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 15000 });

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
}

const taskRow = {
  id: "task-1",
  meeting_id: "meeting-1",
  user_id: "user-1",
  dedupe_key: "dedupe-1",
  description: "Enviar proposta",
  owner: null,
  due_date: null,
  priority: "média",
  status: "todo",
  completed: false,
  completed_at: null,
  created_at: "2026-04-09T09:00:00.000Z",
  source: "manual",
  group_id: null,
  meetings: { title: "Kickoff", client_name: "Acme" },
  task_label_map: [],
};

function createAdminClient(options: {
  ownedMeeting?: { id: string; user_id: string } | null;
  insertedTask?: { id: string } | null;
  createdTaskRow?: typeof taskRow | null;
}) {
  const meetingsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.ownedMeeting === undefined ? { id: "meeting-1", user_id: "user-1" } : options.ownedMeeting,
          error: null,
        }),
      })),
    })),
  };

  const insertSingle = vi.fn().mockResolvedValue({
    data: options.insertedTask === undefined ? { id: "task-1" } : options.insertedTask,
    error: options.insertedTask === null ? { message: "insert failed" } : null,
  });

  const refetchSingle = vi.fn().mockResolvedValue({
    data: options.createdTaskRow === undefined ? taskRow : options.createdTaskRow,
    error: null,
  });

  const insert = vi.fn(() => ({
    select: vi.fn(() => ({ single: insertSingle })),
  }));

  const select = vi.fn(() => ({
    eq: vi.fn(() => ({ single: refetchSingle })),
  }));

  const labelMapEq = vi.fn().mockResolvedValue({ error: null });
  const labelMapInsert = vi.fn().mockResolvedValue({ error: null });
  const labelMapTable = {
    delete: vi.fn(() => ({ eq: labelMapEq })),
    insert: labelMapInsert,
  };

  const tasksTable = { insert, select };

  const from = vi.fn((table: string) => {
    if (table === "meetings") return meetingsTable;
    if (table === "tasks") return tasksTable;
    if (table === "task_label_map") return labelMapTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, insert, labelMapInsert, labelMapEq };
}

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new Request("http://localhost/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 403 when the meeting does not belong to the authenticated user", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createAdminClient({ ownedMeeting: null }));

    const mod = await import("./route");
    const response = await mod.POST(
      buildRequest({ description: "Nova tarefa", meeting_id: "meeting-2" })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Acesso negado." });
  });

  it("creates the task and returns 201 with the mapped task", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.POST(
      buildRequest({
        description: "Enviar proposta",
        meeting_id: "meeting-1",
        priority: "alta",
        status: "todo",
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.task).toMatchObject({ id: "task-1", title: "Enviar proposta", columnId: "todo" });
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        meeting_id: "meeting-1",
        user_id: "user-1",
        description: "Enviar proposta",
      })
    );
  });

  it("marks the task as completed when created directly with completed status", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    await mod.POST(
      buildRequest({ description: "Tarefa finalizada", meeting_id: "meeting-1", status: "completed" })
    );

    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        completed: true,
        completed_at: expect.any(String),
      })
    );
  });

  it("syncs label associations when label_ids is provided", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    await mod.POST(
      buildRequest({
        description: "Tarefa com labels",
        meeting_id: "meeting-1",
        label_ids: ["label-1", "label-2"],
      })
    );

    expect(admin.labelMapEq).toHaveBeenCalledWith("task_id", "task-1");
    expect(admin.labelMapInsert).toHaveBeenCalledWith([
      { task_id: "task-1", label_id: "label-1" },
      { task_id: "task-1", label_id: "label-2" },
    ]);
  });

  it("returns 400 when description is missing", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createAdminClient({}));

    const mod = await import("./route");
    const response = await mod.POST(buildRequest({ meeting_id: "meeting-1" }));

    expect(response.status).toBe(400);
  });
});
