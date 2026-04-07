import { beforeEach, describe, expect, it, vi } from "vitest";

describe("processing api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches lightweight meeting status through /api/meetings/:id/status", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "meeting-1",
          title: "Kickoff",
          status: "completed",
          taskCount: 3,
          decisionCount: 2,
        }),
        { status: 200 }
      )
    );

    const mod = await import("./processing-api");
    const status = await mod.fetchMeetingStatus("meeting-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings/meeting-1/status", {
      method: "GET",
    });
    expect(status).toEqual({
      id: "meeting-1",
      title: "Kickoff",
      status: "completed",
      taskCount: 3,
      decisionCount: 2,
    });
  });
});
