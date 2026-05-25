import { beforeEach, describe, expect, it, vi } from "vitest";

const getOwnedMeetingWithRelations = vi.fn();

vi.mock("@/lib/meetings/detail", () => ({
  getOwnedMeetingWithRelations,
}));

describe("meeting detail api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    getOwnedMeetingWithRelations.mockReset();
  });

  it("loads meeting detail from shared server helper and maps page data", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("meeting detail should not fetch /api internally"));

    getOwnedMeetingWithRelations.mockResolvedValue({
          id: "meeting-1",
          user_id: "user-1",
          title: "Reunião — Acme",
          client_name: "Acme",
          meeting_date: "2026-04-07T09:00:00.000Z",
          audio_r2_key: "meetings/user-1/audio.m4a",
          transcript: "Linha 1\nLinha 2",
          summary_whatsapp:
            "Reunião: Acme\nParticipantes: Speaker A, Acme\n\nDecisões tomadas:\n• Seguir com a proposta premium.",
          summary_structured: {
            version: 1,
            title: "Reunião — Acme",
            sections: [
              {
                title: "Contexto",
                content: "A proposta premium foi discutida.",
                participant_ids: ["participant-1", "entity-1"],
              },
            ],
            action_items: [
              {
                description: "Enviar proposta",
                participant_id: "participant-1",
                due_date: null,
                priority: "média",
              },
            ],
          },
          summary_version: 1,
          summary_json: {
            meeting: {
              participants: ["Ana", "Bruno"],
            },
            decisions: [],
            tasks: [],
            open_items: [
              {
                description: "Enviar proposta",
                context: null,
              },
            ],
            next_meeting: {
              datetime: null,
              location_or_link: "https://meet.example.com/abc",
            },
          },
          whatsapp_number: "+5511999999999",
          whatsapp_status: "sent",
          status: "completed",
          source: "upload",
          duration_seconds: 3600,
          cost_usd: 1.25,
          assemblyai_transcript_id: null,
          prompt_version: null,
          error_message: null,
          created_at: "2026-04-07T09:00:00.000Z",
          completed_at: "2026-04-07T10:00:00.000Z",
          tasks: [
            {
              id: "task-1",
              meeting_id: "meeting-1",
              user_id: "user-1",
              dedupe_key: "task-1",
              description: "Enviar proposta",
              owner: "Ana",
              due_date: "2026-04-10",
              priority: "média",
              status: "in_progress",
              completed: false,
              completed_at: null,
              created_at: "2026-04-07T09:30:00.000Z",
            },
          ],
          decisions: [
            {
              id: "decision-1",
              meeting_id: "meeting-1",
              user_id: "user-1",
              dedupe_key: "decision-1",
              description: "Seguir com a proposta premium",
              decided_by: "Bruno",
              confidence: "alta",
              created_at: "2026-04-07T09:31:00.000Z",
            },
          ],
          open_items: [
            {
              id: "open-1",
              meeting_id: "meeting-1",
              user_id: "user-1",
              dedupe_key: "open-1",
              description: "Enviar proposta",
              context: null,
              created_at: "2026-04-07T09:31:00.000Z",
            },
          ],
          meeting_participants: [
            {
              id: "participant-1",
              meeting_id: "meeting-1",
              display_name: "Ana Atualizada",
              original_name: "Speaker A",
              role: "participant",
              created_at: "2026-04-07T09:00:00.000Z",
              updated_at: "2026-04-07T09:10:00.000Z",
            },
            {
              id: "entity-1",
              meeting_id: "meeting-1",
              display_name: "Acme Atualizada",
              original_name: "Acme",
              role: "entity",
              created_at: "2026-04-07T09:00:00.000Z",
              updated_at: "2026-04-07T09:10:00.000Z",
            },
          ],
    });

    const mod = await import("./meeting-api");
    const meeting = await mod.fetchMeetingDetail("meeting-1");

    expect(getOwnedMeetingWithRelations).toHaveBeenCalledWith("meeting-1");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(meeting.clientName).toBe("Acme");
    expect(meeting.meetingStatus).toBe("completed");
    expect(meeting.participants).toEqual([
      {
        id: "participant-1",
        name: "Ana Atualizada",
        originalName: "Speaker A",
        role: "participant",
      },
    ]);
    expect(meeting.entities).toEqual([
      {
        id: "entity-1",
        name: "Acme Atualizada",
        originalName: "Acme",
        role: "entity",
      },
    ]);
    expect(meeting.summaryStructured).toEqual({
      version: 1,
      title: "Reunião — Acme",
      sections: [
        {
          title: "Contexto",
          content: "A proposta premium foi discutida.",
          participant_ids: ["participant-1", "entity-1"],
        },
      ],
      action_items: [
        {
          description: "Enviar proposta",
          participant_id: "participant-1",
          due_date: null,
          priority: "média",
        },
      ],
    });
    expect(meeting.summary).toContain("Decisões tomadas:");
    expect(meeting.summary).toContain("Ana Atualizada");
    expect(meeting.summary).toContain("Acme Atualizada");
    expect(meeting.summary).not.toContain("Participantes citados");
    expect(meeting.tasks[0]).toEqual(
      expect.objectContaining({
        id: "task-1",
        text: "Enviar proposta",
        priority: "Média",
        status: "in_progress",
      })
    );
    expect(meeting.keyDecision).toBe("Seguir com a proposta premium");
    expect(meeting.alertPoint).toBe("Enviar proposta");
    expect(meeting.location).toBe("https://meet.example.com/abc");
  });

  it("throws a useful error when shared server helper fails", async () => {
    getOwnedMeetingWithRelations.mockRejectedValue(
      new Error("Falha ao carregar reunião.")
    );

    const mod = await import("./meeting-api");

    await expect(mod.fetchMeetingDetail("meeting-1")).rejects.toThrow(
      "Falha ao carregar reunião."
    );
  });
});
