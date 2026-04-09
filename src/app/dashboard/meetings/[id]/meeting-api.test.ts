import { beforeEach, describe, expect, it, vi } from "vitest";

describe("meeting detail api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches a meeting detail through /api/meetings/:id and maps page data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "meeting-1",
          user_id: "user-1",
          title: "Reunião — Acme",
          client_name: "Acme",
          meeting_date: "2026-04-07T09:00:00.000Z",
          audio_r2_key: "meetings/user-1/audio.m4a",
          transcript: "Linha 1\nLinha 2",
          summary_whatsapp: "Resumo pronto",
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
        }),
        { status: 200 }
      )
    );

    const mod = await import("./meeting-api");
    const meeting = await mod.fetchMeetingDetail("meeting-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings/meeting-1", {
      method: "GET",
    });
    expect(meeting.clientName).toBe("Acme");
    expect(meeting.meetingStatus).toBe("completed");
    expect(meeting.participants).toEqual([{ name: "Ana" }, { name: "Bruno" }]);
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
});
