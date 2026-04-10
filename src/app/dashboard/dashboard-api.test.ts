import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardOverview = vi.fn();

vi.mock("@/lib/dashboard/overview", () => ({
  getDashboardOverview,
}));

describe("dashboard api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
    getDashboardOverview.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads dashboard overview from server helper and maps data for the page", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("dashboard should not fetch /api internally"));

    getDashboardOverview.mockResolvedValue({
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
    });

    const mod = await import("./dashboard-api");
    const overview = await mod.fetchDashboardOverview();

    expect(getDashboardOverview).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it("throws a useful error when the server helper fails", async () => {
    getDashboardOverview.mockRejectedValue(
      new Error("Falha ao carregar dashboard.")
    );
    const mod = await import("./dashboard-api");

    await expect(mod.fetchDashboardOverview()).rejects.toThrow(
      "Falha ao carregar dashboard."
    );
  });
});
