import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authContext = {
  user: { id: "user-1" },
  supabase: {},
  supabaseAdmin: {},
} as never;

const getOwnedMeetingsForAuth = vi.fn();
const getOwnedMeetingsPageForAuth = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (
      request: Request,
      context: { params: Record<string, string> }
    ) => {
      return handler(request, { ...context, auth: authContext });
    };
  },
}));

vi.mock("@/lib/meetings/list", () => ({
  getOwnedMeetingsForAuth,
  getOwnedMeetingsPageForAuth,
}));

function buildMeeting(index: number) {
  return {
    id: `meeting-${index}`,
    title: `Meeting ${index}`,
    client_name: `Client ${index}`,
    group_id: index % 2 === 0 ? "group-1" : null,
    group_name: index % 2 === 0 ? "Project A" : null,
    created_at: `2026-04-${10 + index}T10:00:00.000Z`,
    status: "completed",
  };
}

describe("GET /api/meetings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns all meetings retrocompatibly when no pagination params are provided", async () => {
    getOwnedMeetingsForAuth.mockResolvedValue([
      {
        id: "meeting-1",
        title: "Kickoff",
        client_name: "Acme",
        group_id: "group-1",
        group_name: "Project A",
        created_at: "2026-04-10T10:00:00.000Z",
        status: "completed",
      },
    ]);

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings"),
      { params: {} } as never
    );

    expect(getOwnedMeetingsForAuth).toHaveBeenCalledWith(authContext);
    expect(getOwnedMeetingsPageForAuth).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      meetings: [
        {
          id: "meeting-1",
          title: "Kickoff",
          clientName: "Acme",
          groupId: "group-1",
          groupName: "Project A",
          createdAt: "2026-04-10T10:00:00.000Z",
          status: "completed",
        },
      ],
    });
  });

  it("returns a paginated page with nextCursor and hasMore", async () => {
    const meetings = [buildMeeting(1), buildMeeting(2)];
    getOwnedMeetingsPageForAuth.mockResolvedValue({
      meetings,
      nextCursor: "cursor-token",
      hasMore: true,
    });

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings?limit=2&cursor=prev-cursor"),
      { params: {} } as never
    );

    expect(getOwnedMeetingsPageForAuth).toHaveBeenCalledWith(authContext, {
      limit: 2,
      cursor: "prev-cursor",
      groupId: undefined,
    });
    expect(getOwnedMeetingsForAuth).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      meetings: meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        clientName: meeting.client_name,
        groupId: meeting.group_id,
        groupName: meeting.group_name,
        createdAt: meeting.created_at,
        status: meeting.status,
      })),
      nextCursor: "cursor-token",
      hasMore: true,
    });
  });

  it("filters by groupId when provided", async () => {
    const meetings = [buildMeeting(0)];
    getOwnedMeetingsPageForAuth.mockResolvedValue({
      meetings,
      nextCursor: null,
      hasMore: false,
    });

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings?groupId=group-1&limit=10"),
      { params: {} } as never
    );

    expect(getOwnedMeetingsPageForAuth).toHaveBeenCalledWith(authContext, {
      limit: 10,
      cursor: undefined,
      groupId: "group-1",
    });
    expect(response.status).toBe(200);
  });

  it("returns 500 when the shared helper fails", async () => {
    getOwnedMeetingsForAuth.mockRejectedValue(new Error("db is down"));

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings"),
      { params: {} } as never
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Erro ao carregar reuniões.",
    });
  });

  it("returns 500 when the paginated helper fails", async () => {
    getOwnedMeetingsPageForAuth.mockRejectedValue(new Error("db is down"));

    const mod = await import("./route");
    const response = await mod.GET(
      new NextRequest("http://localhost/api/meetings?limit=5"),
      { params: {} } as never
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Erro ao carregar reuniões.",
    });
  });
});
