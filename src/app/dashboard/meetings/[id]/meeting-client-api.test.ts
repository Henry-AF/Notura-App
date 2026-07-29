import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMeetingDetailPayload() {
  return {
    id: "meeting-1",
    title: "Reunião — Acme",
    client_name: "Acme",
    meeting_date: "2026-04-07T09:00:00.000Z",
    created_at: "2026-04-07T09:00:00.000Z",
    audio_r2_key: null,
    transcript: "Linha 1",
    summary_whatsapp: "Resumo da reunião com a Acme.",
    summary_structured: null,
    summary_json: null,
    status: "completed",
    meeting_participants: [],
    tasks: [
      {
        id: "task-1",
        description: "Enviar proposta",
        completed: false,
        status: "todo",
        owner: "Ana",
        priority: "alta",
        due_date: null,
        completed_at: null,
        created_at: "2026-04-07T09:30:00.000Z",
      },
    ],
    decisions: [
      {
        id: "decision-1",
        description: "Seguir com o plano premium.",
        decided_by: "Bruno",
        confidence: "alta",
        created_at: "2026-04-07T09:30:00.000Z",
      },
    ],
    open_items: [],
  };
}

describe("meeting chat api", () => {
  it("loads archived chats for the current meeting through the owned API route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse([
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
      ])
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

describe("meeting lifecycle actions", () => {
  it("deletes a meeting through the owned API route", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse({ success: true }));

    const mod = await import("./meeting-client-api");
    await mod.deleteMeetingById("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1", {
      method: "DELETE",
    });
  });

  it("cancels meeting processing through the owned API route", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse({ success: true }));

    const mod = await import("./meeting-client-api");
    await mod.cancelMeetingProcessing("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/meetings/meeting-1/cancel-processing",
      {
        method: "POST",
      }
    );
  });

  it("throws a useful error when processing cancellation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ error: "Nao foi possivel cancelar." }, 409)
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.cancelMeetingProcessing("meeting-1")).rejects.toThrow(
      "Nao foi possivel cancelar."
    );
  });

  it("throws a useful error when the meeting deletion fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ error: "Nao foi possivel excluir." }, 500)
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.deleteMeetingById("meeting-1")).rejects.toThrow(
      "Nao foi possivel excluir."
    );
  });
});

describe("meeting participants api", () => {
  it("renames a detected meeting participant through the meeting participants API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        participant: {
          id: "participant-1",
          displayName: "Ana Nova",
          originalName: "Speaker A",
          role: "participant",
        },
      })
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.updateMeetingParticipantDisplayName(
      "meeting-1",
      "participant-1",
      "Ana Nova",
      "entity"
    );

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/participants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: "participant-1",
        displayName: "Ana Nova",
        role: "entity",
      }),
    });
    expect(result.name).toBe("Ana Nova");
  });

  it("merges a detected meeting participant through the meeting participants API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        participant: {
          id: "participant-2",
          displayName: "Gabriel",
          originalName: "Gabriel",
          role: "participant",
        },
      })
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.mergeMeetingParticipant(
      "meeting-1",
      "participant-1",
      "participant-2"
    );

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/participants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId: "participant-1",
        mergeIntoParticipantId: "participant-2",
      }),
    });
    expect(result.name).toBe("Gabriel");
  });
});

describe("meeting templates api", () => {
  it("fetches available meeting templates through the meeting-templates API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        templates: [
          { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
          { id: "template-1", name: "Meu modelo", isDefault: false, editable: true },
        ],
      })
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.fetchMeetingTemplates();

    expect(fetchSpy).toHaveBeenCalledWith("/api/meeting-templates");
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      id: "template-1",
      name: "Meu modelo",
      isDefault: false,
      editable: true,
    });
  });

  it("throws a useful error when loading meeting templates fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ error: "Erro ao listar." }, 500)
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.fetchMeetingTemplates()).rejects.toThrow("Erro ao listar.");
  });
});

describe("meeting ata export api", () => {
  it("exports the meeting ata with the default template when none is given", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        url: "https://r2.example/ata.docx",
        filename: "ata-reuniao.docx",
        expiresIn: 3600,
      })
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.exportMeetingAta("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(result).toEqual({
      url: "https://r2.example/ata.docx",
      filename: "ata-reuniao.docx",
    });
  });

  it("exports the meeting ata with a custom templateId", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        url: "https://r2.example/ata.docx",
        filename: "ata-reuniao.docx",
        expiresIn: 3600,
      })
    );

    const mod = await import("./meeting-client-api");
    await mod.exportMeetingAta("meeting-1", "template-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "template-1" }),
    });
  });

  it("surfaces the upgrade message when export is blocked by plan", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(
        {
          error: "Exportar a ata em .docx está disponível apenas para assinantes dos planos Starter e Pro.",
        },
        403
      )
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.exportMeetingAta("meeting-1")).rejects.toThrow(
      "Exportar a ata em .docx está disponível apenas para assinantes dos planos Starter e Pro."
    );
  });
});

describe("meeting status and detail refetch api", () => {
  it("fetches meeting status including the current processing step", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        id: "meeting-1",
        title: "Reunião — Acme",
        status: "processing",
        processingStep: "summarize-meeting",
        jobStatus: "running",
        errorMessage: null,
        taskCount: 2,
        decisionCount: 1,
      })
    );

    const mod = await import("./meeting-client-api");
    const result = await mod.fetchMeetingStatus("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1/status");
    expect(result.status).toBe("processing");
    expect(result.processingStep).toBe("summarize-meeting");
    expect(result.taskCount).toBe(2);
  });

  it("fetches and maps the full meeting detail after processing completes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse(createMeetingDetailPayload()));

    const mod = await import("./meeting-client-api");
    const result = await mod.fetchMeetingDetailData("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1");
    expect(result.clientName).toBe("Acme");
    expect(result.meetingStatus).toBe("completed");
    expect(result.summary).toBe("Resumo da reunião com a Acme.");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: "task-1",
      text: "Enviar proposta",
      priority: "Alta",
      status: "todo",
    });
    expect(result.keyDecision).toBe("Seguir com o plano premium.");
  });

  it("throws a useful error when the meeting detail refetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ error: "Acesso negado." }, 403)
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.fetchMeetingDetailData("meeting-1")).rejects.toThrow(
      "Acesso negado."
    );
  });
});
