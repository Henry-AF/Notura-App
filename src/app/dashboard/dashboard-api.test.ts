import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("dashboard api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches dashboard overview and maps data for the page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          userName: "Ana",
          plan: "free",
          meetingsThisMonth: 2,
          monthlyLimit: 3,
          recentMeetings: [
            {
              id: "meeting-1",
              title: "Kickoff",
              clientName: "Acme",
              createdAt: "2026-04-07T10:00:00.000Z",
              status: "pending",
            },
          ],
          openTasks: [
            {
              id: "task-1",
              text: "Enviar contrato",
              completed: false,
              createdAt: "2026-04-07T11:00:00.000Z",
            },
          ],
          openTaskCount: 1,
          hoursSaved: 4,
          todayCount: 2,
        }),
        { status: 200 }
      )
    );

    const mod = await import("./dashboard-api");
    const overview = await mod.fetchDashboardOverview();

    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/overview", {
      method: "GET",
    });
    expect(overview.userName).toBe("Ana");
    expect(overview.plan).toBe("free");
    expect(overview.meetings[0]?.status).toBe("processing");
    expect(overview.tasks[0]?.isNew).toBe(true);
    expect(overview.metrics).toEqual([
      expect.objectContaining({ label: "Reuniões este mês", value: 2 }),
      expect.objectContaining({ label: "Tarefas abertas", value: 1 }),
      expect.objectContaining({ label: "Horas economizadas", value: 4 }),
    ]);
    expect(overview.todayCount).toBe(2);
  });

  it("throws a useful error when the overview request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Falha ao carregar dashboard." }), {
        status: 500,
      })
    );

    const mod = await import("./dashboard-api");

    await expect(mod.fetchDashboardOverview()).rejects.toThrow(
      "Falha ao carregar dashboard."
    );
  });
});
