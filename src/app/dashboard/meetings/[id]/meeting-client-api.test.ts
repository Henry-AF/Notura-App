import { afterEach, describe, expect, it, vi } from "vitest";

function createChatResponse(status: "processing" | "completed") {
  return new Response(
    JSON.stringify({
      id: "chat-1",
      status,
      question: "Qual foi o prazo?",
      answer: status === "completed" ? "Sexta-feira." : null,
      fallbackReason: null,
      modelConfirmed: status === "completed" ? true : null,
      sources: [],
      errorMessage: null,
      createdAt: "2026-05-07T10:00:00.000Z",
      completedAt: status === "completed" ? "2026-05-07T10:00:03.000Z" : null,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}

describe("meeting detail client api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it("cancels meeting processing through the owned API route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./meeting-client-api");
    await mod.cancelMeetingProcessing("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/meetings/meeting-1/cancel-processing",
      {
        method: "POST",
      }
    );
  });

  it("renames a detected meeting participant through the meeting participants API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          participant: {
            id: "participant-1",
            displayName: "Ana Nova",
            originalName: "Speaker A",
            role: "participant",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.updateMeetingParticipantDisplayName(
      "meeting-1",
      "participant-1",
      "Ana Nova"
    );

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/participants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: "participant-1",
        displayName: "Ana Nova",
      }),
    });
    expect(result.name).toBe("Ana Nova");
  });

  it("throws a useful error when processing cancellation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Nao foi possivel cancelar." }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.cancelMeetingProcessing("meeting-1")).rejects.toThrow(
      "Nao foi possivel cancelar."
    );
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

  it("polls chat status quickly at first and backs off between attempts", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(createChatResponse("processing"))
      .mockResolvedValueOnce(createChatResponse("processing"))
      .mockResolvedValueOnce(createChatResponse("completed"));

    const mod = await import("./meeting-client-api");
    const promise = mod.waitForMeetingChat("meeting-1", "chat-1", {
      maxAttempts: 5,
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("completed");
  });
});
