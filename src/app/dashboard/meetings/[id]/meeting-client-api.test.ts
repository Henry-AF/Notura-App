import { afterEach, describe, expect, it, vi } from "vitest";

describe("meeting detail client api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads archived chats for the current meeting through the owned API route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "chat-1",
            status: "completed",
            question: "Qual foi o prazo?",
            answer: "Sexta-feira.",
            fallbackReason: null,
            modelConfirmed: true,
            sources: [],
            errorMessage: null,
            createdAt: "2026-05-07T10:00:00.000Z",
            completedAt: "2026-05-07T10:00:03.000Z",
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.fetchMeetingArchivedChats("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/chats");
    expect(result).toEqual([
      expect.objectContaining({
        id: "chat-1",
        question: "Qual foi o prazo?",
      }),
    ]);
  });

  it("deletes a meeting through the owned API route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./meeting-client-api");
    await mod.deleteMeetingById("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1", {
      method: "DELETE",
    });
  });

  it("throws a useful error when the meeting deletion fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Nao foi possivel excluir." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.deleteMeetingById("meeting-1")).rejects.toThrow(
      "Nao foi possivel excluir."
    );
  });
});
