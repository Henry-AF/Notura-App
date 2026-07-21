import { describe, expect, it } from "vitest";
import { buildAtaData, buildAtaFilename } from "./meeting-ata-data";
import type { MeetingWithRelations } from "@/types/database";

function baseMeeting(
  overrides: Partial<MeetingWithRelations> = {}
): MeetingWithRelations {
  return {
    id: "meeting-1",
    user_id: "user-1",
    group_id: null,
    title: "Reunião de Alinhamento",
    client_name: "Acme",
    meeting_date: "2026-04-07T09:00:00.000Z",
    audio_r2_key: null,
    transcript: null,
    summary_whatsapp: "Reunião: Acme\nParticipantes: Ana, Bruno",
    summary_json: {
      meeting: { participants: ["Ana", "Bruno"] },
      decisions: [],
      tasks: [],
      open_items: [],
      summary_one_line: "Alinhar o roadmap do trimestre.",
    },
    summary_structured: null,
    summary_version: 1,
    whatsapp_number: "+5511999999999",
    whatsapp_status: "sent",
    status: "completed",
    source: "upload",
    duration_seconds: 1800,
    cost_usd: 1,
    assemblyai_transcript_id: null,
    prompt_version: null,
    error_message: null,
    created_at: "2026-04-07T09:00:00.000Z",
    completed_at: "2026-04-07T09:30:00.000Z",
    tasks: [],
    decisions: [],
    open_items: [],
    meeting_participants: [],
    ...overrides,
  };
}

describe("buildAtaData", () => {
  it("maps a fully populated meeting into ATA data", () => {
    const meeting = baseMeeting({
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
          source: "ai_extracted",
          group_id: null,
        },
      ],
      decisions: [
        {
          id: "decision-1",
          meeting_id: "meeting-1",
          user_id: "user-1",
          dedupe_key: "decision-1",
          description: "Seguir com o plano premium",
          decided_by: "Bruno",
          confidence: "alta",
          created_at: "2026-04-07T09:15:00.000Z",
        },
      ],
      open_items: [
        {
          id: "open-1",
          meeting_id: "meeting-1",
          user_id: "user-1",
          dedupe_key: "open-1",
          description: "Confirmar orçamento com o financeiro",
          context: null,
          created_at: "2026-04-07T09:20:00.000Z",
        },
      ],
      meeting_participants: [
        {
          id: "participant-1",
          meeting_id: "meeting-1",
          display_name: "Ana",
          original_name: "Ana",
          role: "participant",
          created_at: "2026-04-07T09:00:00.000Z",
          updated_at: "2026-04-07T09:00:00.000Z",
        },
      ],
      summary_structured: {
        version: 1,
        title: "Reunião de Alinhamento",
        sections: [
          {
            title: "Roadmap",
            content: "Discussão sobre prioridades do trimestre.",
            participant_ids: ["participant-1"],
          },
        ],
        action_items: [],
      },
    });

    const ata = buildAtaData(meeting);

    expect(ata.meeting_title).toBe("Reunião de Alinhamento");
    expect(ata.objective).toBe("Alinhar o roadmap do trimestre.");
    expect(ata.participants).toEqual([{ name: "Ana" }]);
    expect(ata.topics).toEqual([
      { title: "Roadmap", content: "Discussão sobre prioridades do trimestre." },
    ]);
    expect(ata.decisions).toEqual([
      { description: "Seguir com o plano premium", decided_by: "Bruno" },
    ]);
    expect(ata.tasks).toEqual([
      { description: "Enviar proposta", owner: "Ana", due_date: expect.any(String) },
    ]);
    expect(ata.next_steps).toBe("Confirmar orçamento com o financeiro");
    expect(ata.executive_summary.length).toBeGreaterThan(0);
  });

  it("renders empty sections without throwing for a meeting with no relations", () => {
    const meeting = baseMeeting({
      summary_json: {
        meeting: { participants: [] },
        decisions: [],
        tasks: [],
        open_items: [],
        summary_one_line: null,
      },
      summary_whatsapp: null,
    });

    const ata = buildAtaData(meeting);

    expect(ata.participants).toEqual([]);
    expect(ata.topics).toEqual([]);
    expect(ata.decisions).toEqual([]);
    expect(ata.tasks).toEqual([]);
    expect(ata.next_steps).toBe("");
    expect(ata.objective).toBe("");
  });

  it("falls back decisions and tasks to an unassigned label when missing an owner", () => {
    const meeting = baseMeeting({
      tasks: [
        {
          id: "task-2",
          meeting_id: "meeting-1",
          user_id: "user-1",
          dedupe_key: "task-2",
          description: "Revisar contrato",
          owner: null,
          due_date: null,
          priority: "baixa",
          status: "todo",
          completed: false,
          completed_at: null,
          created_at: "2026-04-07T09:35:00.000Z",
          source: "manual",
          group_id: null,
        },
      ],
      decisions: [
        {
          id: "decision-2",
          meeting_id: "meeting-1",
          user_id: "user-1",
          dedupe_key: "decision-2",
          description: "Adiar o lançamento",
          decided_by: null,
          confidence: "média",
          created_at: "2026-04-07T09:40:00.000Z",
        },
      ],
    });

    const ata = buildAtaData(meeting);

    expect(ata.tasks[0].owner).toBe("Não especificado");
    expect(ata.tasks[0].due_date).toBe("Sem prazo definido");
    expect(ata.decisions[0].decided_by).toBe("Não especificado");
  });
});

describe("buildAtaFilename", () => {
  it("builds a slug from the meeting title", () => {
    const meeting = baseMeeting({ title: "Reunião de Kickoff — Acme!" });
    expect(buildAtaFilename(meeting)).toBe("ata-reuniao-de-kickoff-acme.docx");
  });

  it("falls back to the meeting id when there is no usable title", () => {
    const meeting = baseMeeting({ title: null, client_name: null, id: "meeting-42" });
    expect(buildAtaFilename(meeting)).toBe("ata-meeting-42.docx");
  });
});
