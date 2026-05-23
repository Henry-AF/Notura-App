import { describe, expect, it } from "vitest";
import { renderMeetingSummary } from "./summary-renderer";
import type {
  MeetingJSON,
  MeetingParticipant,
  MeetingStructuredSummary,
} from "@/types/database";

const meetingParticipants: MeetingParticipant[] = [
  {
    id: "p1-id",
    meeting_id: "meeting-1",
    display_name: "Ana Atualizada",
    original_name: "Speaker A",
    role: "participant",
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
  {
    id: "e1-id",
    meeting_id: "meeting-1",
    display_name: "Acme Atualizada",
    original_name: "Acme",
    role: "entity",
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
];

const structuredSummary: MeetingStructuredSummary = {
  version: 1,
  title: "Reuniao",
  sections: [
    {
      title: "Contexto",
      content: "A proposta foi discutida.",
      participant_ids: ["p1-id", "e1-id"],
    },
  ],
  action_items: [
    {
      description: "Enviar proposta",
      participant_id: "p1-id",
      due_date: null,
      priority: "média",
    },
  ],
};

describe("renderMeetingSummary", () => {
  it("renders structured summaries with the latest participant display names", () => {
    const result = renderMeetingSummary({
      summaryStructured: structuredSummary,
      meetingParticipants,
      summaryWhatsapp: "Resumo legado",
      summaryJson: null,
    });

    expect(result.text).toContain("Ana Atualizada");
    expect(result.text).toContain("Acme Atualizada");
    expect(result.actionItems[0].participantName).toBe("Ana Atualizada");
  });

  it("keeps entities separate from effective meeting participants", () => {
    const result = renderMeetingSummary({
      summaryStructured: structuredSummary,
      meetingParticipants,
      summaryWhatsapp: null,
      summaryJson: null,
    });

    expect(result.participants).toEqual([
      { id: "p1-id", name: "Ana Atualizada", originalName: "Speaker A" },
    ]);
    expect(result.entities).toEqual([
      { id: "e1-id", name: "Acme Atualizada", originalName: "Acme" },
    ]);
  });

  it("uses legacy WhatsApp summary and participants when structured summary is absent", () => {
    const summaryJson: MeetingJSON = {
      meeting: {
        participants: ["Ana Legada", "Bruno Legado"],
      },
      decisions: [],
      tasks: [],
      open_items: [],
    };

    const result = renderMeetingSummary({
      summaryStructured: null,
      meetingParticipants: [],
      summaryWhatsapp: "Resumo legado pronto",
      summaryJson,
    });

    expect(result.text).toBe("Resumo legado pronto");
    expect(result.participants).toEqual([
      { name: "Ana Legada" },
      { name: "Bruno Legado" },
    ]);
    expect(result.entities).toEqual([]);
  });
});
