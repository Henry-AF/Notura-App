import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = ".github/scripts/dispatch-postconditions.mjs";
const WORKFLOWS = [
  { file: "dispatch-claude-code.yml", agent: "Claude Code" },
  { file: "dispatch-codex.yml", agent: "Codex" },
] as const;

function readWorkflow(file: string): string {
  return readFileSync(`.github/workflows/${file}`, "utf8");
}

function runValidate(changed: string, prUrl = "") {
  const directory = mkdtempSync(join(tmpdir(), "dispatch-policy-"));
  const summary = join(directory, "summary.md");
  const report = join(directory, "report.md");
  writeFileSync(report, "Relatório preservado");
  const result = spawnSync(process.execPath, [SCRIPT, "validate"], {
    encoding: "utf8",
    env: {
      ...process.env,
      AGENT_NAME: "Codex",
      CHANGED: changed,
      GITHUB_STEP_SUMMARY: summary,
      ISSUE_KEY: "NOT-222",
      PR_URL: prUrl,
      REPORT_PATH: report,
      RUN_URL: "https://example.test/run",
    },
  });
  return { result, summary: readFileSync(summary, "utf8") };
}

describe.each(WORKFLOWS)("$file", ({ file, agent }) => {
  it("usa o script comum depois de registrar o resultado no Linear", () => {
    const workflow = readWorkflow(file);
    const comment = workflow.indexOf("- name: Registrar o resultado no Linear");
    const validation = workflow.indexOf("- name: Validar pós-condições do dispatch");

    expect(comment).toBeGreaterThanOrEqual(0);
    expect(validation).toBeGreaterThan(comment);
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain(`AGENT_NAME: ${agent}`);
    expect(workflow).toContain(`${SCRIPT} comment`);
    expect(workflow).toContain(`${SCRIPT} validate`);
  });

  it("preserva o relatório fora de .dispatch antes de verificar o diff", () => {
    const workflow = readWorkflow(file);
    const preserve = workflow.indexOf("- name: Preservar o relatório do agente");
    const diff = workflow.indexOf("- name: Verificar se houve alteração");

    expect(preserve).toBeGreaterThanOrEqual(0);
    expect(preserve).toBeLessThan(diff);
    expect(workflow).toContain("REPORT_PATH: ${{ runner.temp }}/agent-report.md");
    expect(workflow).toContain(`${SCRIPT} preserve`);
  });
});

describe("dispatch-postconditions.mjs", () => {
  it("falha sem diff e inclui o relatório no summary", () => {
    const { result, summary } = runValidate("false");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("::error title=Dispatch sem alteração");
    expect(summary).toContain("Relatório preservado");
  });

  it("falha quando há diff sem PR", () => {
    const { result, summary } = runValidate("true");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("::error title=Dispatch sem PR");
    expect(summary).toContain("sem URL de PR");
  });

  it("sucede quando há diff e PR", () => {
    const directory = mkdtempSync(join(tmpdir(), "dispatch-policy-"));
    const result = spawnSync(process.execPath, [SCRIPT, "validate"], {
      env: {
        ...process.env,
        CHANGED: "true",
        PR_URL: "https://example.test/pr/1",
        GITHUB_STEP_SUMMARY: join(directory, "summary.md"),
      },
    });
    expect(result.status).toBe(0);
  });

  it("gera o comentário sem diff com o relatório preservado", () => {
    const directory = mkdtempSync(join(tmpdir(), "dispatch-policy-"));
    const comment = join(directory, "comment.md");
    const report = join(directory, "report.md");
    writeFileSync(report, "Diagnóstico final");
    const result = spawnSync(process.execPath, [SCRIPT, "comment"], {
      env: {
        ...process.env,
        AGENT_NAME: "Claude Code",
        CHANGED: "false",
        COMMENT_PATH: comment,
        REPORT_PATH: report,
        RUN_URL: "https://example.test/run",
      },
    });

    expect(result.status).toBe(0);
    expect(readFileSync(comment, "utf8")).toContain("Diagnóstico final");
  });
});
