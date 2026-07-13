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

const baseTaskRow = {
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

function createTaskAdminClient(options: {
  ownershipRow?: { id: string; user_id: string } | null;
  updatedRow?: typeof baseTaskRow | null;
  refreshedRow?: typeof baseTaskRow;
}) {
  const ownershipMaybeSingle = vi.fn().mockResolvedValue({
    data: options.ownershipRow === undefined ? { id: "task-1", user_id: "user-1" } : options.ownershipRow,
    error: null,
  });

  const updateSingle = vi.fn().mockResolvedValue({
    data: options.updatedRow === undefined ? baseTaskRow : options.updatedRow,
    error: options.updatedRow === null ? { message: "update failed" } : null,
  });

  const refreshSingle = vi.fn().mockResolvedValue({
    data: options.refreshedRow ?? (options.updatedRow === undefined ? baseTaskRow : options.updatedRow),
    error: null,
  });

  const update = vi.fn((_payload: Record<string, unknown>) => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => ({ single: updateSingle })),
    })),
  }));

  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn(() => ({ eq: deleteEq }));

  const select = vi.fn((columns: string) => {
    if (columns === "id, user_id") {
      return { eq: vi.fn(() => ({ maybeSingle: ownershipMaybeSingle })) };
    }
    return { eq: vi.fn(() => ({ single: refreshSingle })) };
  });

  const tasksTable = { select, update, delete: del };

  const labelMapEq = vi.fn().mockResolvedValue({ error: null });
  const labelMapInsert = vi.fn().mockResolvedValue({ error: null });
  const labelMapTable = {
    delete: vi.fn(() => ({ eq: labelMapEq })),
    insert: labelMapInsert,
  };

  const from = vi.fn((table: string) => {
    if (table === "tasks") return tasksTable;
    if (table === "task_label_map") return labelMapTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, update, del, deleteEq, labelMapEq, labelMapInsert, refreshSingle };
}

function buildRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new Request("http://localhost/api/tasks/task-1", {
    method,
    body: body ? JSON.stringify(body) : undefined,
  }) as NextRequest;
}

// ─── buildUpdatePayload (pure whitelist mapping) ───────────────────────────────

describe("buildUpdatePayload", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("ignores fields that are not part of the whitelist", async () => {
    const { buildUpdatePayload } = await import("@/lib/tasks/task-mapper");
    const payload = buildUpdatePayload({
      description: "Nova descrição",
      user_id: "attacker",
      dedupe_key: "forged-key",
      source: "hacked",
      meeting_id: "other-meeting",
    });

    expect(payload).toEqual({ description: "Nova descrição" });
  });

  it("sets completed=true and completed_at when status moves to completed", async () => {
    const { buildUpdatePayload } = await import("@/lib/tasks/task-mapper");
    const payload = buildUpdatePayload({ status: "completed" });

    expect(payload.status).toBe("completed");
    expect(payload.completed).toBe(true);
    expect(payload.completed_at).toEqual(expect.any(String));
  });

  it("clears completed and completed_at when status moves away from completed", async () => {
    const { buildUpdatePayload } = await import("@/lib/tasks/task-mapper");
    const payload = buildUpdatePayload({ status: "todo" });

    expect(payload.status).toBe("todo");
    expect(payload.completed).toBe(false);
    expect(payload.completed_at).toBeNull();
  });

  it("derives status from a boolean completed flag", async () => {
    const { buildUpdatePayload } = await import("@/lib/tasks/task-mapper");
    expect(buildUpdatePayload({ completed: true })).toEqual(
      expect.objectContaining({ completed: true, status: "completed" })
    );
    expect(buildUpdatePayload({ completed: false })).toEqual(
      expect.objectContaining({ completed: false, status: "todo", completed_at: null })
    );
  });
});

// ─── PATCH /api/tasks/[id] ──────────────────────────────────────────────────────

describe("PATCH /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 403 when the task does not belong to the authenticated user", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createTaskAdminClient({ ownershipRow: null }));

    const mod = await import("./route");
    const response = await mod.PATCH(buildRequest("PATCH", { description: "x" }), {
      params: { id: "task-1" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Acesso negado." });
  });

  it("only sends whitelisted fields to the update call", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createTaskAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.PATCH(
      buildRequest("PATCH", {
        description: "Atualizada",
        user_id: "attacker",
        dedupe_key: "forged",
        source: "hacked",
        meeting_id: "other-meeting",
      }),
      { params: { id: "task-1" } }
    );

    expect(response.status).toBe(200);
    expect(admin.update).toHaveBeenCalledWith({ description: "Atualizada" });
  });

  it("marks the task completed when moved to the completed status", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createTaskAdminClient({
      updatedRow: { ...baseTaskRow, status: "completed", completed: true, completed_at: "2026-04-10T00:00:00.000Z" },
    });
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    await mod.PATCH(buildRequest("PATCH", { status: "completed" }), { params: { id: "task-1" } });

    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", completed: true, completed_at: expect.any(String) })
    );
  });

  it("clears completed fields when moved away from the completed status", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createTaskAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    await mod.PATCH(buildRequest("PATCH", { status: "todo" }), { params: { id: "task-1" } });

    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "todo", completed: false, completed_at: null })
    );
  });

  it("syncs labels and returns the refreshed task when label_ids is provided", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createTaskAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.PATCH(
      buildRequest("PATCH", { label_ids: ["label-1", "label-2"] }),
      { params: { id: "task-1" } }
    );

    expect(response.status).toBe(200);
    expect(admin.labelMapEq).toHaveBeenCalledWith("task_id", "task-1");
    expect(admin.labelMapInsert).toHaveBeenCalledWith([
      { task_id: "task-1", label_id: "label-1" },
      { task_id: "task-1", label_id: "label-2" },
    ]);
    expect(admin.refreshSingle).toHaveBeenCalled();
  });
});

// ─── DELETE /api/tasks/[id] ─────────────────────────────────────────────────────

describe("DELETE /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 403 when the task does not belong to the authenticated user", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createTaskAdminClient({ ownershipRow: null }));

    const mod = await import("./route");
    const response = await mod.DELETE(buildRequest("DELETE"), { params: { id: "task-1" } });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Acesso negado." });
  });

  it("deletes the task and returns success when owned by the authenticated user", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    const admin = createTaskAdminClient({});
    createServiceRoleClient.mockReturnValue(admin);

    const mod = await import("./route");
    const response = await mod.DELETE(buildRequest("DELETE"), { params: { id: "task-1" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(admin.deleteEq).toHaveBeenCalledWith("id", "task-1");
  });
});
