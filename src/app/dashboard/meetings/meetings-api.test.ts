import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOwnedMeetings = vi.fn();

vi.mock("@/lib/meetings/list", () => ({
  getOwnedMeetings,
}));

describe("meetings api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
    getOwnedMeetings.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads meetings from shared server helper and normalizes status", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("meetings page should not fetch /api internally"));

    getOwnedMeetings.mockResolvedValue([
      {
        id: "meeting-1",
        title: "Kickoff",
        client_name: "Acme",
        created_at: "2026-04-07T08:00:00.000Z",
        status: "pending",
      },
      {
        id: "meeting-2",
        title: "QBR",
        client_name: "Globex",
        created_at: "2026-04-06T08:00:00.000Z",
        status: "failed",
      },
    ]);

    const mod = await import("./meetings-api");
    const meetings = await mod.fetchMeetings();

    expect(getOwnedMeetings).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(meetings).toEqual([
      expect.objectContaining({
        id: "meeting-1",
        clientName: "Acme",
        title: "Kickoff",
        status: "processing",
        rawDate: "2026-04-07T08:00:00.000Z",
      }),
      expect.objectContaining({
        id: "meeting-2",
        status: "failed",
      }),
    ]);
  });

  it("throws a useful error when shared server helper fails", async () => {
    getOwnedMeetings.mockRejectedValue(
      new Error("Falha ao carregar reuniões.")
    );

    const mod = await import("./meetings-api");

    await expect(mod.fetchMeetings()).rejects.toThrow(
      "Falha ao carregar reuniões."
    );
  });
});
