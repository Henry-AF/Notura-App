import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(name: string): string {
  return readFileSync(resolve(process.cwd(), ".github/workflows", name), "utf8");
}

describe("dispatch model cost policy", () => {
  it("pins Claude Code to Sonnet 4.6 instead of Opus or an action default", () => {
    const workflow = readWorkflow("dispatch-claude-code.yml");

    expect(workflow).toContain("--model claude-sonnet-4-6");
    expect(workflow).not.toContain("claude-opus");
  });

  it("pins Codex to the cost-sensitive Luna model", () => {
    const workflow = readWorkflow("dispatch-codex.yml");

    expect(workflow).toContain("model: gpt-5.6-luna");
  });

  it("keeps the existing agent and merge safety brakes", () => {
    const claude = readWorkflow("dispatch-claude-code.yml");
    const codex = readWorkflow("dispatch-codex.yml");

    expect(claude).toContain("persist-credentials: false");
    expect(claude).not.toMatch(/allowedTools[^\n]*(?:git|gh)(?:[:,)*]|\s)/i);
    expect(codex).toContain("persist-credentials: false");
    expect(codex).toContain("permission-profile: ':workspace'");
    expect(claude).toContain("--draft");
    expect(codex).toContain("--draft");
  });
});
