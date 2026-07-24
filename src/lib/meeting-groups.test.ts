import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteAuthContext } from "@/lib/api/auth";

const requireOwnership = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireOwnership,
  requireAuth: vi.fn(),
}));

function createChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve(result));
  chain.single = vi.fn(() => Promise.resolve(result));
  return chain as {
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

function createGroupsAdminClient(options: {
  groupsResult?: { data: unknown; error: unknown };
  meetingsResult?: { data: unknown; error: unknown };
  mutationResult?: { data: unknown; error: unknown };
}) {
  const groupsChain = createChain(options.groupsResult ?? { data: [], error: null });
  const meetingsChain = createChain(options.meetingsResult ?? { data: [], error: null });
  const mutationChain = createChain(options.mutationResult ?? { data: null, error: null });

  const groupsSelect = vi.fn(() => groupsChain);
  const meetingsSelect = vi.fn(() => meetingsChain);
  const insert = vi.fn(() => mutationChain);
  const update = vi.fn(() => mutationChain);

  const from = vi.fn((table: string) => {
    if (table === "meetings") {
      return { select: meetingsSelect };
    }
    return { select: groupsSelect, insert, update };
  });

  return {
    client: { from } as never,
    groupsChain,
    meetingsChain,
    mutationChain,
    groupsSelect,
    meetingsSelect,
    insert,
    update,
  };
}

describe("getMeetingGroupsSnapshotForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out archived groups by default", async () => {
    const { client, groupsChain } = createGroupsAdminClient({
      groupsResult: { data: [], error: null },
    });

    const { getMeetingGroupsSnapshotForUser } = await import("./meeting-groups");
    await getMeetingGroupsSnapshotForUser(client, "user-1");

    expect(groupsChain.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("includes archived groups when includeArchived is true", async () => {
    const { client, groupsChain } = createGroupsAdminClient({
      groupsResult: { data: [], error: null },
    });

    const { getMeetingGroupsSnapshotForUser } = await import("./meeting-groups");
    await getMeetingGroupsSnapshotForUser(client, "user-1", true);

    expect(groupsChain.is).not.toHaveBeenCalled();
  });

  it("maps meetings_count per group and passes archived_at through", async () => {
    const { client } = createGroupsAdminClient({
      groupsResult: {
        data: [
          {
            id: "group-1",
            name: "Acme",
            created_at: "2026-04-16T12:00:00Z",
            updated_at: "2026-04-16T12:00:00Z",
            archived_at: null,
          },
          {
            id: "group-2",
            name: "Old client",
            created_at: "2026-01-01T12:00:00Z",
            updated_at: "2026-01-01T12:00:00Z",
            archived_at: "2026-02-01T12:00:00Z",
          },
        ],
        error: null,
      },
      meetingsResult: {
        data: [
          { id: "m1", title: "Kickoff", client_name: "Acme", status: "completed", created_at: "2026-04-16T12:30:00Z", group_id: "group-1" },
          { id: "m2", title: "Follow-up", client_name: "Acme", status: "completed", created_at: "2026-04-17T12:30:00Z", group_id: "group-1" },
        ],
        error: null,
      },
    });

    const { getMeetingGroupsSnapshotForUser } = await import("./meeting-groups");
    const snapshot = await getMeetingGroupsSnapshotForUser(client, "user-1", true);

    const group1 = snapshot.groups.find((g) => g.id === "group-1");
    const group2 = snapshot.groups.find((g) => g.id === "group-2");
    expect(group1?.meetings_count).toBe(2);
    expect(group1?.archived_at).toBeNull();
    expect(group2?.archived_at).toBe("2026-02-01T12:00:00Z");
  });
});

describe("setMeetingGroupArchivedForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives a group by setting archived_at and enforces ownership", async () => {
    requireOwnership.mockResolvedValue(undefined);
    const { client, update, mutationChain } = createGroupsAdminClient({});
    mutationChain.single.mockResolvedValue({
      data: {
        id: "group-1",
        name: "Acme",
        created_at: "2026-04-16T12:00:00Z",
        updated_at: "2026-04-16T12:00:00Z",
        archived_at: "2026-05-01T00:00:00.000Z",
      },
      error: null,
    });

    const { setMeetingGroupArchivedForUser } = await import("./meeting-groups");
    const result = await setMeetingGroupArchivedForUser(client, "user-1", "group-1", true);

    expect(requireOwnership).toHaveBeenCalledWith(client, "meeting_groups", "group-1", "user-1");
    expect(update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
    expect(result.archived_at).toBe("2026-05-01T00:00:00.000Z");
  });

  it("unarchives a group by clearing archived_at", async () => {
    requireOwnership.mockResolvedValue(undefined);
    const { client, update, mutationChain } = createGroupsAdminClient({});
    mutationChain.single.mockResolvedValue({
      data: {
        id: "group-1",
        name: "Acme",
        created_at: "2026-04-16T12:00:00Z",
        updated_at: "2026-04-16T12:00:00Z",
        archived_at: null,
      },
      error: null,
    });

    const { setMeetingGroupArchivedForUser } = await import("./meeting-groups");
    const result = await setMeetingGroupArchivedForUser(client, "user-1", "group-1", false);

    expect(update).toHaveBeenCalledWith({ archived_at: null });
    expect(result.archived_at).toBeNull();
  });

  it("propagates ownership rejection without mutating the group", async () => {
    requireOwnership.mockRejectedValue(new Response(null, { status: 403 }));
    const { client, update } = createGroupsAdminClient({});

    const { setMeetingGroupArchivedForUser } = await import("./meeting-groups");

    await expect(
      setMeetingGroupArchivedForUser(client, "user-1", "group-1", true)
    ).rejects.toBeInstanceOf(Response);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("createMeetingGroupForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a group with no archived_at and zero meetings", async () => {
    const { client, mutationChain } = createGroupsAdminClient({});
    mutationChain.single.mockResolvedValue({
      data: {
        id: "group-1",
        name: "Acme",
        created_at: "2026-04-16T12:00:00Z",
        updated_at: "2026-04-16T12:00:00Z",
        archived_at: null,
      },
      error: null,
    });

    const { createMeetingGroupForUser } = await import("./meeting-groups");
    const result = await createMeetingGroupForUser(client, "user-1", "Acme");

    expect(result.archived_at).toBeNull();
    expect(result.meetings_count).toBe(0);
  });
});

// ── Dashboard helpers ──────────────────────────────────────────────────────────
//
// The dashboard queries do not end their chain with `.order()` or `.single()`
// like the snapshot/CRUD queries above — the code awaits the query builder
// directly after the last `.eq()`/`.in()` call. A thenable chain mock is used
// here so `await chain` resolves regardless of how many chained calls precede it.

type ThenableChain = Record<string, ReturnType<typeof vi.fn>> & {
  then: (
    resolve: (value: unknown) => void,
    reject: (reason: unknown) => void
  ) => Promise<unknown>;
};

function createResolvedChain(methods: string[], result: unknown): ThenableChain {
  const chain = {} as ThenableChain;
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

interface DashboardChainOptions {
  meetingsRowsResult?: { data: unknown; error: unknown };
  tasksTotalResult?: { count: number | null; error: unknown };
  tasksCompletedResult?: { count: number | null; error: unknown };
  decisionsResult?: { count: number | null; error: unknown };
}

function createDashboardAdminClient(options: DashboardChainOptions) {
  const meetingsRowsResult = options.meetingsRowsResult ?? { data: [], error: null };
  const tasksTotalResult = options.tasksTotalResult ?? { count: 0, error: null };
  const tasksCompletedResult = options.tasksCompletedResult ?? { count: 0, error: null };
  const decisionsResult = options.decisionsResult ?? { count: 0, error: null };

  const meetingsRowsChain = createResolvedChain(["eq"], meetingsRowsResult);
  const meetingsSelect = vi.fn(() => meetingsRowsChain);

  const tasksCompletedChain = createResolvedChain([], tasksCompletedResult);
  const tasksInChain = {
    eq: vi.fn(() => tasksCompletedChain),
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(tasksTotalResult).then(resolve, reject),
  };
  const tasksChain = { in: vi.fn(() => tasksInChain) };
  const tasksSelect = vi.fn(() => tasksChain);

  const decisionsChain = createResolvedChain(["in"], decisionsResult);
  const decisionsSelect = vi.fn(() => decisionsChain);

  const from = vi.fn((table: string) => {
    if (table === "meetings") return { select: meetingsSelect };
    if (table === "tasks") return { select: tasksSelect };
    if (table === "decisions") return { select: decisionsSelect };
    throw new Error(`Unexpected table in dashboard test: ${table}`);
  });

  return {
    client: { from } as never,
    from,
    meetingsRowsChain,
    meetingsSelect,
    tasksSelect,
    tasksInChain,
    decisionsSelect,
  };
}

describe("getMeetingGroupDashboardForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnership.mockResolvedValue(undefined);
  });

  it("returns meetings, tasks and decisions counters for a populated group", async () => {
    const { client } = createDashboardAdminClient({
      meetingsRowsResult: {
        data: [
          { id: "m1", status: "completed", meeting_date: "2026-01-01T00:00:00Z", summary_whatsapp: "resumo" },
          { id: "m2", status: "completed", meeting_date: "2026-01-02T00:00:00Z", summary_whatsapp: "resumo" },
          { id: "m3", status: "processing", meeting_date: null, summary_whatsapp: null },
        ],
        error: null,
      },
      tasksTotalResult: { count: 5, error: null },
      tasksCompletedResult: { count: 3, error: null },
      decisionsResult: { count: 2, error: null },
    });

    const { getMeetingGroupDashboardForUser } = await import("./meeting-groups");
    const result = await getMeetingGroupDashboardForUser(client, "user-1", "group-1");

    expect(requireOwnership).toHaveBeenCalledWith(client, "meeting_groups", "group-1", "user-1");
    expect(result).toEqual({
      group_id: "group-1",
      meetings_count: 3,
      minutes_count: 2,
      tasks_total: 5,
      tasks_pending: 2,
      tasks_completed: 3,
      decisions_count: 2,
      upcoming_meetings_count: 0,
    });
  });

  it("does not count a completed meeting with no summary_whatsapp toward minutes_count", async () => {
    const { client } = createDashboardAdminClient({
      meetingsRowsResult: {
        data: [
          { id: "m1", status: "completed", meeting_date: null, summary_whatsapp: "resumo" },
          { id: "m2", status: "completed", meeting_date: null, summary_whatsapp: null },
        ],
        error: null,
      },
    });

    const { getMeetingGroupDashboardForUser } = await import("./meeting-groups");
    const result = await getMeetingGroupDashboardForUser(client, "user-1", "group-1");

    expect(result.minutes_count).toBe(1);
  });

  it("counts only future or present meetings toward upcoming_meetings_count", async () => {
    const { client } = createDashboardAdminClient({
      meetingsRowsResult: {
        data: [
          { id: "m1", status: "processing", meeting_date: "2099-01-01T00:00:00Z", summary_whatsapp: null },
          { id: "m2", status: "processing", meeting_date: "2000-01-01T00:00:00Z", summary_whatsapp: null },
          { id: "m3", status: "processing", meeting_date: null, summary_whatsapp: null },
        ],
        error: null,
      },
    });

    const { getMeetingGroupDashboardForUser } = await import("./meeting-groups");
    const result = await getMeetingGroupDashboardForUser(client, "user-1", "group-1");

    expect(result.upcoming_meetings_count).toBe(1);
  });

  it("returns all-zero counters and skips the tasks/decisions queries for a group with no meetings", async () => {
    const { client, tasksSelect, decisionsSelect } = createDashboardAdminClient({
      meetingsRowsResult: { data: [], error: null },
    });

    const { getMeetingGroupDashboardForUser } = await import("./meeting-groups");
    const result = await getMeetingGroupDashboardForUser(client, "user-1", "group-1");

    expect(result).toEqual({
      group_id: "group-1",
      meetings_count: 0,
      minutes_count: 0,
      tasks_total: 0,
      tasks_pending: 0,
      tasks_completed: 0,
      decisions_count: 0,
      upcoming_meetings_count: 0,
    });
    expect(tasksSelect).not.toHaveBeenCalled();
    expect(decisionsSelect).not.toHaveBeenCalled();
  });

  it("propagates the ownership rejection without querying meetings, tasks or decisions", async () => {
    requireOwnership.mockRejectedValue(new Response(null, { status: 403 }));
    const { client, meetingsSelect, tasksSelect, decisionsSelect } = createDashboardAdminClient({});

    const { getMeetingGroupDashboardForUser } = await import("./meeting-groups");

    await expect(
      getMeetingGroupDashboardForUser(client, "user-1", "group-1")
    ).rejects.toBeInstanceOf(Response);
    expect(meetingsSelect).not.toHaveBeenCalled();
    expect(tasksSelect).not.toHaveBeenCalled();
    expect(decisionsSelect).not.toHaveBeenCalled();
  });
});

describe("getMeetingGroupDashboardForAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnership.mockResolvedValue(undefined);
  });

  it("delegates to getMeetingGroupDashboardForUser using the auth context's supabaseAdmin and user id", async () => {
    const { client } = createDashboardAdminClient({
      meetingsRowsResult: {
        data: [{ id: "m1", status: "completed", meeting_date: null, summary_whatsapp: "resumo" }],
        error: null,
      },
      tasksTotalResult: { count: 1, error: null },
      tasksCompletedResult: { count: 1, error: null },
      decisionsResult: { count: 0, error: null },
    });
    const auth = { user: { id: "user-1" }, supabaseAdmin: client } as unknown as RouteAuthContext;

    const { getMeetingGroupDashboardForAuth } = await import("./meeting-groups");
    const result = await getMeetingGroupDashboardForAuth(auth, "group-1");

    expect(requireOwnership).toHaveBeenCalledWith(client, "meeting_groups", "group-1", "user-1");
    expect(result.group_id).toBe("group-1");
    expect(result.minutes_count).toBe(1);
    expect(result.tasks_total).toBe(1);
  });
});
