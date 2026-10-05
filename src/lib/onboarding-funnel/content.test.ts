import { describe, expect, it } from "vitest";
import { getEntryContent, resolvePromise } from "./content";
import { createInitialState } from "./engine";

describe("resolvePromise", () => {
  it("uses the promise of the selected problem", () => {
    const state = { ...createInitialState(), problem: "tasks" as const };
    expect(resolvePromise(state).title).toBe(
      "Nunca mais procure quem ficou responsável por uma tarefa."
    );
  });

  it("adds the profile line and the selected goals", () => {
    const state = {
      ...createInitialState(),
      problem: "minutes" as const,
      profile: "sales" as const,
      goals: ["tasks" as const, "deadlines" as const],
    };
    const promise = resolvePromise(state);

    expect(promise.profileLine).toContain("vende");
    expect(promise.goals).toEqual(["Criar tarefas", "Identificar prazos"]);
  });

  it("falls back to the campaign focus when the answer is 'all'", () => {
    const state = { ...createInitialState("meeting-minutes"), problem: "all" as const };
    expect(resolvePromise(state).title).toBe("Pare de gastar seu tempo escrevendo atas.");
  });

  it("uses the generic promise for 'all' without a known campaign", () => {
    const state = { ...createInitialState("unknown-campaign"), problem: "all" as const };
    expect(resolvePromise(state).title).toContain("organizado para você");
  });
});

describe("getEntryContent", () => {
  it("keeps the default headline and emphasizes the campaign", () => {
    const content = getEntryContent("tasks");

    expect(content.title).toBe("O que costuma acontecer depois das suas reuniões?");
    expect(content.eyebrow).toBe("Tarefas, responsáveis e prazos");
  });

  it("has no eyebrow without a known campaign", () => {
    expect(getEntryContent(undefined).eyebrow).toBeUndefined();
    expect(getEntryContent("nope").eyebrow).toBeUndefined();
  });
});
