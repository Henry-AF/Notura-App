import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RouteAuthContext } from "@/lib/api/auth";
import {
  getMeetingsForUser,
  getOwnedMeetingsPageForAuth,
  type MeetingsPageOptions,
} from "./list";

type MockSupabaseClient = SupabaseClient<Database>;

function createMockQuery() {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    or: vi.fn(() => query),
    then: vi.fn(),
  };
  return query;
}

function createMockSupabase(rows: unknown[]): MockSupabaseClient {
  const query = createMockQuery();
  query.then.mockImplementation(
    (callback: (result: { data: unknown[]; error: null }) => unknown) => {
      return Promise.resolve(callback({ data: rows, error: null }));
    }
  );
  return {
    from: () => query,
  } as unknown as MockSupabaseClient;
}

function createAuthContext(supabaseAdmin: MockSupabaseClient): RouteAuthContext {
  return {
    user: { id: "user-1" } as RouteAuthContext["user"],
    supabase: {} as RouteAuthContext["supabase"],
    supabaseAdmin,
  };
}

function buildRow(index: number) {
  return {
    id: `meeting-${index}`,
    title: `Meeting ${index}`,
    client_name: `Client ${index}`,
    group_id: index === 0 ? "group-1" : null,
    status: "completed",
    created_at: `2026-04-${10 + index}T10:00:00.000Z`,
    meeting_groups: index === 0 ? { name: "Project A" } : null,
  };
}

describe("getMeetingsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps raw rows to MeetingsListItem including group_id and group_name", async () => {
    const rows = [buildRow(0)];
    const supabaseAdmin = createMockSupabase(rows) as MockSupabaseClient;

    const result = await getMeetingsForUser(supabaseAdmin, "user-1");

    expect(result).toEqual([
      {
        id: "meeting-0",
        title: "Meeting 0",
        client_name: "Client 0",
        group_id: "group-1",
        group_name: "Project A",
        status: "completed",
        created_at: "2026-04-10T10:00:00.000Z",
      },
    ]);
  });
});

describe("getOwnedMeetingsPageForAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a full page without cursor when there are fewer rows than limit", async () => {
    const rows = [buildRow(0), buildRow(1)];
    const supabaseAdmin = createMockSupabase(rows) as MockSupabaseClient;
    const auth = createAuthContext(supabaseAdmin);

    const result = await getOwnedMeetingsPageForAuth(auth, { limit: 5 });

    expect(result.meetings).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns hasMore true and a cursor when there are more rows than limit", async () => {
    const rows = [buildRow(0), buildRow(1), buildRow(2)];
    const supabaseAdmin = createMockSupabase(rows) as MockSupabaseClient;
    const auth = createAuthContext(supabaseAdmin);

    const result = await getOwnedMeetingsPageForAuth(auth, { limit: 2 });

    expect(result.meetings).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]+$/));
  });

  it("applies groupId filter", async () => {
    const rows = [buildRow(0)];
    const query = createMockQuery();
    query.then.mockImplementation(
      (callback: (result: { data: unknown[]; error: null }) => unknown) => {
        return Promise.resolve(callback({ data: rows, error: null }));
      }
    );
    const supabaseAdmin = {
      from: () => query,
    } as unknown as MockSupabaseClient;
    const auth = createAuthContext(supabaseAdmin);

    await getOwnedMeetingsPageForAuth(auth, { groupId: "group-1", limit: 10 });

    expect(query.eq).toHaveBeenCalledWith("group_id", "group-1");
  });

  it("applies cursor filter when cursor is valid", async () => {
    const rows = [buildRow(0)];
    const query = createMockQuery();
    query.then.mockImplementation(
      (callback: (result: { data: unknown[]; error: null }) => unknown) => {
        return Promise.resolve(callback({ data: rows, error: null }));
      }
    );
    const supabaseAdmin = {
      from: () => query,
    } as unknown as MockSupabaseClient;
    const auth = createAuthContext(supabaseAdmin);

    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "2026-04-12T10:00:00.000Z", id: "meeting-2" })
    ).toString("base64url");

    await getOwnedMeetingsPageForAuth(auth, { cursor, limit: 10 });

    expect(query.or).toHaveBeenCalledWith(
      "created_at.lt.2026-04-12T10:00:00.000Z,and(created_at.eq.2026-04-12T10:00:00.000Z,id.lt.meeting-2)"
    );
  });

  it("ignores an invalid cursor", async () => {
    const rows = [buildRow(0)];
    const query = createMockQuery();
    query.then.mockImplementation(
      (callback: (result: { data: unknown[]; error: null }) => unknown) => {
        return Promise.resolve(callback({ data: rows, error: null }));
      }
    );
    const supabaseAdmin = {
      from: () => query,
    } as unknown as MockSupabaseClient;
    const auth = createAuthContext(supabaseAdmin);

    await getOwnedMeetingsPageForAuth(auth, { cursor: "not-a-cursor", limit: 10 });

    expect(query.or).not.toHaveBeenCalled();
  });
});
