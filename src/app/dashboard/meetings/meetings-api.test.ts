import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("meetings api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches meetings through /api/meetings and normalizes status", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          meetings: [
            {
              id: "meeting-1",
              title: "Kickoff",
              clientName: "Acme",
              createdAt: "2026-04-07T08:00:00.000Z",
              status: "pending",
            },
            {
              id: "meeting-2",
              title: "QBR",
              clientName: "Globex",
              createdAt: "2026-04-06T08:00:00.000Z",
              status: "failed",
            },
          ],
        }),
        { status: 200 }
      )
    );

    const mod = await import("./meetings-api");
    const meetings = await mod.fetchMeetings();

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings", { method: "GET" });
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
});
