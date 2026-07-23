import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveGroup,
  createGroup,
  fetchGroupsPageData,
  mapGroupsPageData,
  moveMeetingToGroup,
  removeGroup,
  renameGroup,
  unarchiveGroup,
} from "./groups-api";

const apiGroup = {
  id: "group-1",
  name: "Acme",
  created_at: "2026-04-16T12:00:00Z",
  updated_at: "2026-04-16T12:00:00Z",
  archived_at: null,
  meetings_count: 2,
};

const apiMeeting = {
  id: "meeting-1",
  title: "Reuniao - Acme",
  client_name: "Acme",
  status: "completed",
  created_at: "2026-04-16T12:30:00Z",
  group_id: "group-1",
};

describe("groups page api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps the groups snapshot without changing ownership-sensitive ids", () => {
    const result = mapGroupsPageData({
      groups: [
        {
          id: "group-1",
          name: "Acme",
          createdAt: apiGroup.created_at,
          updatedAt: apiGroup.updated_at,
          archivedAt: null,
          meetingsCount: 2,
        },
      ],
      meetings: [
        {
          id: "meeting-1",
          title: "Reuniao - Acme",
          status: "completed",
          createdAt: apiMeeting.created_at,
          groupId: "group-1",
        },
      ],
    });

    expect(result.groups[0].id).toBe("group-1");
    expect(result.groups[0].archivedAt).toBeNull();
    expect(result.meetings[0].groupId).toBe("group-1");
  });

  it("fetches only active groups by default through the authenticated API route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ groups: [apiGroup], meetings: [apiMeeting] }),
        { status: 200 }
      )
    );

    const result = await fetchGroupsPageData();

    expect(fetchMock).toHaveBeenCalledWith("/api/meeting-groups", {
      method: "GET",
    });
    expect(result.groups[0].meetingsCount).toBe(2);
    expect(result.meetings[0].title).toBe("Reuniao - Acme");
  });

  it("fetches archived groups too when includeArchived is true", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ groups: [], meetings: [] }), { status: 200 })
    );

    await fetchGroupsPageData(true);

    expect(fetchMock).toHaveBeenCalledWith("/api/meeting-groups?include_archived=1", {
      method: "GET",
    });
  });

  it("creates, renames, archives, unarchives, deletes and moves through API routes", async () => {
    const archivedGroup = { ...apiGroup, archived_at: "2026-05-01T00:00:00.000Z" };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ group: apiGroup }), { status: 201 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ group: apiGroup }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ group: archivedGroup }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ group: apiGroup }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ meetingId: "meeting-1" }), { status: 200 })
      );

    await createGroup("Acme");
    await renameGroup("group-1", "Acme Renovado");
    const archived = await archiveGroup("group-1");
    await unarchiveGroup("group-1");
    await removeGroup("group-1");
    await moveMeetingToGroup("meeting-1", null);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/meeting-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Acme" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/meeting-groups/group-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    expect(archived.archivedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/meeting-groups/group-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(6, "/api/meetings/meeting-1/group", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupId: null }),
    });
  });
});
