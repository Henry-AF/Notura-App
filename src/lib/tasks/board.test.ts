import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireAuth,
}));

type QueryResult = { data: unknown; error: unknown };

function createQueryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

function createAdminClient(options?: {
  tasksResult?: QueryResult;
  meetingsResult?: QueryResult;
}) {
  const tasksBuilder = createQueryBuilder(
    options?.tasksResult ?? { data: [], error: null }
  );
  const meetingsBuilder = createQueryBuilder(
    options?.meetingsResult ?? { data: [], error: null }
  );

  const from = vi.fn((table: string) => {
    if (table === "tasks") return tasksBuilder;
    if (table === "meetings") return meetingsBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from }, tasksBuilder, meetingsBuilder };
}

const taskRow = {
  id: "task-1",
  meeting_id: "meeting-1",
  user_id: "user-1",
  dedupe_key: "dedupe-1",
  description: "Finalizar proposta",
  owner: "Ana",
  due_date: null,
  priority: "média",
  status: "todo",
  completed: false,
  completed_at: null,
  created_at: "2026-04-09T09:00:00.000Z",
  source: "manual",
  group_id: null,
  meetings: { title: "Kickoff", client_name: "Acme" },
};

const meetingRow = { id: "meeting-1", title: "Kickoff", client_name: "Acme" };

describe("getTaskBoardForUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("builds columns and meetings from the owned rows", async () => {
    const { client, tasksBuilder, meetingsBuilder } = createAdminClient({
      tasksResult: { data: [taskRow], error: null },
      meetingsResult: { data: [meetingRow], error: null },
    });

    const mod = await import("./board");
    const result = await mod.getTaskBoardForUser(client as never, "user-1");

    expect(tasksBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(meetingsBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result.columns.find((c) => c.id === "todo")?.tasks).toHaveLength(1);
    expect(result.meetings).toEqual([
      { id: "meeting-1", title: "Kickoff", clientName: "Acme", label: "Acme - Kickoff" },
    ]);
  });

  it("applies meetingId and groupId filters when provided", async () => {
    const { client, tasksBuilder } = createAdminClient({
      tasksResult: { data: [], error: null },
    });

    const mod = await import("./board");
    await mod.getTaskBoardForUser(client as never, "user-1", {
      meetingId: "meeting-1",
      groupId: "group-1",
    });

    expect(tasksBuilder.eq).toHaveBeenCalledWith("meeting_id", "meeting-1");
    expect(tasksBuilder.eq).toHaveBeenCalledWith("group_id", "group-1");
  });

  it("throws when the tasks query fails", async () => {
    const { client } = createAdminClient({
      tasksResult: { data: null, error: { message: "db down" } },
    });

    const mod = await import("./board");

    await expect(
      mod.getTaskBoardForUser(client as never, "user-1")
    ).rejects.toThrow("Erro ao buscar tarefas.");
  });

  it("throws when the meetings query fails", async () => {
    const { client } = createAdminClient({
      meetingsResult: { data: null, error: { message: "db down" } },
    });

    const mod = await import("./board");

    await expect(
      mod.getTaskBoardForUser(client as never, "user-1")
    ).rejects.toThrow("Erro ao buscar reuniões.");
  });
});

describe("getOwnedTaskBoardForAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("delegates to getTaskBoardForUser using the auth context", async () => {
    const { client } = createAdminClient({
      tasksResult: { data: [taskRow], error: null },
      meetingsResult: { data: [meetingRow], error: null },
    });
    const auth = {
      user: { id: "user-1" },
      supabase: {},
      supabaseAdmin: client,
    } as never;

    const mod = await import("./board");
    const result = await mod.getOwnedTaskBoardForAuth(auth);

    expect(result.meetings).toHaveLength(1);
  });
});

describe("getOwnedTaskBoard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAuth.mockReset();
  });

  it("resolves the current user via requireAuth and returns their board", async () => {
    const { client } = createAdminClient({
      tasksResult: { data: [taskRow], error: null },
      meetingsResult: { data: [meetingRow], error: null },
    });
    requireAuth.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {},
      supabaseAdmin: client,
    });

    const mod = await import("./board");
    const result = await mod.getOwnedTaskBoard();

    expect(requireAuth).toHaveBeenCalledTimes(1);
    expect(result.columns).toHaveLength(3);
  });
});
