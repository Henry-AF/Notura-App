import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const getOwnedMeetingForEdit = vi.fn();
const getOwnedMeetingGroupsSnapshot = vi.fn();

vi.mock("@/lib/meetings/edit", () => ({
  getOwnedMeetingForEdit,
}));

vi.mock("@/lib/meeting-groups", () => ({
  getOwnedMeetingGroupsSnapshot,
}));

describe("meeting edit api helper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    getOwnedMeetingForEdit.mockReset();
    getOwnedMeetingGroupsSnapshot.mockReset();
  });

  it("loads edit data from shared server helper without fetching /api internally", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("meeting edit page should not fetch /api internally"));

    getOwnedMeetingForEdit.mockResolvedValue({
      id: "meeting-1",
      title: "Kickoff",
      client_name: "Acme",
      meeting_date: "2026-04-10",
      group_id: "group-1",
      created_at: "2026-04-10T10:00:00.000Z",
    });
    getOwnedMeetingGroupsSnapshot.mockResolvedValue({
      groups: [
        {
          id: "group-1",
          name: "Acme",
          created_at: "2026-04-01T10:00:00.000Z",
          updated_at: "2026-04-01T10:00:00.000Z",
          meetings_count: 1,
        },
      ],
      meetings: [],
    });

    const mod = await import("./meeting-edit-api");
    const data = await mod.fetchMeetingEditData("meeting-1");

    expect(getOwnedMeetingForEdit).toHaveBeenCalledWith("meeting-1");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(data).toEqual({
      id: "meeting-1",
      title: "Kickoff",
      meetingDate: "2026-04-10",
      groupId: "group-1",
      meetingGroups: [{ id: "group-1", name: "Acme" }],
    });
  });

  it("updates editable fields without sending client name through PATCH /api/meetings/:id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "meeting-1",
          title: "Novo título",
          meetingDate: "2026-04-09",
          groupId: "group-1",
        }),
        { status: 200 }
      )
    );

    const mod = await import("./meeting-edit-client-api");
    const updated = await mod.updateMeetingEditableFields("meeting-1", {
      title: "Novo título",
      meetingDate: "2026-04-09",
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Novo título",
        meetingDate: "2026-04-09",
      }),
    });

    expect(updated).toEqual({
      id: "meeting-1",
      title: "Novo título",
      meetingDate: "2026-04-09",
      groupId: "group-1",
      meetingGroups: [],
    });
  });

  it("keeps client modules decoupled from server-only edit helper", async () => {
    const baseDir = path.dirname(fileURLToPath(import.meta.url));
    const clientModules = ["meeting-edit-client.tsx", "meeting-edit-client-api.ts"];

    for (const fileName of clientModules) {
      const source = await readFile(path.join(baseDir, fileName), "utf8");
      expect(source).not.toMatch(/from\s+["']\.\/meeting-edit-api["']/);
    }
  });
});
