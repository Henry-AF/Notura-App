import { describe, expect, it } from "vitest";
import { resolveSummary } from "./meeting-summary-resolver";

describe("resolveSummary", () => {
  it("keeps the existing summary text format when resolving edited names", () => {
    const text = resolveSummary(
      {
        version: 1,
        title: "Renovação",
        sections: [
          {
            title: "Contexto",
            content: "Contrato será revisado.",
            participant_ids: ["participant-1", "entity-1"],
          },
        ],
        action_items: [
          {
            description: "Enviar proposta atualizada",
            participant_id: "participant-1",
            due_date: "sexta-feira",
            priority: "alta",
          },
        ],
      },
      [
        {
          id: "participant-1",
          name: "Ana Atualizada",
          originalName: "Speaker A",
          role: "participant",
        },
        {
          id: "entity-1",
          name: "Acme Atualizada",
          originalName: "Acme",
          role: "entity",
        },
      ],
      "Reunião: Renovação\nParticipantes: Speaker A, Acme\n\nDecisões tomadas:\n• Contrato será revisado."
    );

    expect(text).toContain("Reunião: Renovação");
    expect(text).toContain("Ana Atualizada");
    expect(text).toContain("Acme Atualizada");
    expect(text).toContain("Decisões tomadas:");
    expect(text).not.toContain("Participantes citados");
    expect(text).not.toContain("Enviar proposta atualizada");
  });
});
