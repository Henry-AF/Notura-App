import { beforeEach, describe, expect, it, vi } from "vitest";

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
