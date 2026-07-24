import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGroupDashboard, mapGroupDashboard } from "./group-dashboard-api";

const apiDashboard = {
  group_id: "group-1",
  meetings_count: 5,
  minutes_count: 3,
  tasks_total: 10,
  tasks_pending: 4,
  tasks_completed: 6,
  decisions_count: 2,
  upcoming_meetings_count: 1,
};

describe("mapGroupDashboard", () => {
  it("maps the raw dashboard payload to the view shape", () => {
    const result = mapGroupDashboard(apiDashboard);

    expect(result).toEqual({
      groupId: "group-1",
      meetingsCount: 5,
      minutesCount: 3,
      tasksTotal: 10,
      tasksPending: 4,
      tasksCompleted: 6,
      decisionsCount: 2,
      upcomingMeetingsCount: 1,
    });
  });

  it("maps a fully empty group to zeroed indicators", () => {
    const result = mapGroupDashboard({
      group_id: "group-empty",
      meetings_count: 0,
      minutes_count: 0,
      tasks_total: 0,
      tasks_pending: 0,
      tasks_completed: 0,
      decisions_count: 0,
      upcoming_meetings_count: 0,
    });

    expect(result.meetingsCount).toBe(0);
    expect(result.tasksTotal).toBe(0);
    expect(result.upcomingMeetingsCount).toBe(0);
  });
});

describe("fetchGroupDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the dashboard through the authenticated API route", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ dashboard: apiDashboard }), { status: 200 })
    );

    const result = await fetchGroupDashboard("group-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/meeting-groups/group-1/dashboard", {
      method: "GET",
    });
    expect(result.groupId).toBe("group-1");
    expect(result.tasksTotal).toBe(10);
  });

  it("throws with the API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Acesso negado." }), { status: 403 })
    );

    await expect(fetchGroupDashboard("group-1")).rejects.toThrow("Acesso negado.");
  });

  it("throws the fallback message when the response has no dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );

    await expect(fetchGroupDashboard("group-1")).rejects.toThrow(
      "Erro ao carregar indicadores do grupo."
    );
  });
});
