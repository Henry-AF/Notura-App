import { describe, expect, it } from "vitest";
import {
  parseGeminiMeetingSummaryEnvelope,
  rewriteStructuredSummaryRefs,
} from "./summary-structured";

const envelope = {
  participants: [
    {
      ref: "p1",
      display_name: "Ana",
      original_name: "Speaker A",
      role: "participant",
    },
    {
      ref: "e1",
      display_name: "Acme",
      original_name: "Acme",
      role: "entity",
    },
  ],
  summary_whatsapp: "Resumo pronto",
  summary_json: {
    version: "1.0",
    meeting: { title: "Reuniao", participants: ["Ana"], participant_count: 1 },
    decisions: [],
    tasks: [],
    open_items: [],
  },
  summary_structured: {
    version: 1,
    title: "Reuniao",
    sections: [
      {
        title: "Contexto",
        content: "A Acme foi citada.",
        participant_refs: ["e1"],
      },
    ],
    action_items: [
      {
        description: "Enviar proposta",
        participant_ref: "p1",
        due_date: null,
        priority: "média",
      },
    ],
  },
};

describe("parseGeminiMeetingSummaryEnvelope", () => {
  it("accepts participants, entities and structured refs from one Gemini envelope", () => {
    const parsed = parseGeminiMeetingSummaryEnvelope(envelope);

    expect(parsed.participants).toHaveLength(2);
    expect(parsed.summaryStructured.actionItems[0].participantRef).toBe("p1");
  });

  it("rejects section refs that are not declared in participants", () => {
    const invalid = structuredClone(envelope);
    invalid.summary_structured.sections[0].participant_refs = ["missing"];

    expect(() => parseGeminiMeetingSummaryEnvelope(invalid)).toThrow(
      "Gemini returned structured summary refs that were not declared"
    );
  });

  it("rejects action item owners that point to entities", () => {
    const invalid = structuredClone(envelope);
    invalid.summary_structured.action_items[0].participant_ref = "e1";

    expect(() => parseGeminiMeetingSummaryEnvelope(invalid)).toThrow(
      "Action item participant_ref must point to a participant"
    );
  });
});

describe("rewriteStructuredSummaryRefs", () => {
  it("rewrites temporary refs to database ids", () => {
    const parsed = parseGeminiMeetingSummaryEnvelope(envelope);
    const result = rewriteStructuredSummaryRefs(parsed.summaryStructured, {
      p1: { id: "participant-id", role: "participant" },
      e1: { id: "entity-id", role: "entity" },
    });

    expect(result.sections[0].participant_ids).toEqual(["entity-id"]);
    expect(result.action_items[0].participant_id).toBe("participant-id");
  });
});
