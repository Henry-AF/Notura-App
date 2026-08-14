import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOWS = [
  { file: "dispatch-claude-code.yml", agent: "Claude Code" },
  { file: "dispatch-codex.yml", agent: "Codex" },
] as const;

function readWorkflow(file: string) {
  return readFileSync(`.github/workflows/${file}`, "utf8");
}

/**
 * Extrai, na ordem em que aparecem, os nomes dos steps do job (linhas
 * `- name: ...`), para permitir comparar a posição relativa de dois steps
 * sem depender de indexOf de string crua no arquivo inteiro.
 */
function extractStepNames(workflow: string): string[] {
  const stepNameLine = /^\s*- name: (.+)$/;
  return workflow
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .map((line) => stepNameLine.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1].trim());
}

/**
 * Extrai o bloco de texto de um step (do `- name:` até o próximo `- name:`
 * no mesmo nível ou o fim do arquivo), para inspecionar sua condição e seu
 * `run:` isoladamente.
 */
function extractStepBlock(workflow: string, stepName: string): string {
  const lines = workflow.split("\n");
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*- name: ${stepName}\\s*$`).test(line)
  );
  if (startIndex === -1) {
    throw new Error(`Step "${stepName}" não encontrado no workflow.`);
  }

  const indent = lines[startIndex].match(/^\s*/)?.[0].length ?? 0;
  const endIndex = lines
    .slice(startIndex + 1)
    .findIndex((line) => {
      const trimmed = line.trimEnd();
      if (trimmed.length === 0) return false;
      const lineIndent = line.match(/^\s*/)?.[0].length ?? 0;
      return lineIndent === indent && /^\s*- name: /.test(line);
    });

  const stepLines =
    endIndex === -1
      ? lines.slice(startIndex)
      : lines.slice(startIndex, startIndex + 1 + endIndex);

  return stepLines.join("\n");
}

describe.each(WORKFLOWS)(
  "$file: falha visível quando não há diff",
  ({ file, agent }) => {
    it("contém um step que falha explicitamente quando steps.diff.outputs.changed == 'false'", () => {
      const workflow = readWorkflow(file);
      const noDiffStep = extractStepBlock(
        workflow,
        "Falhar quando o agente não produziu alteração"
      );

      expect(noDiffStep).toContain("steps.diff.outputs.changed == 'false'");
      expect(noDiffStep).toContain("exit 1");
      expect(noDiffStep).toContain("::error");
    });

    it("posiciona o step de falha depois do step que comenta no Linear", () => {
      const workflow = readWorkflow(file);
      const stepNames = extractStepNames(workflow);

      const commentIndex = stepNames.indexOf("Registrar o resultado no Linear");
      const failIndex = stepNames.indexOf(
        "Falhar quando o agente não produziu alteração"
      );

      expect(commentIndex).toBeGreaterThanOrEqual(0);
      expect(failIndex).toBeGreaterThanOrEqual(0);
      expect(failIndex).toBeGreaterThan(commentIndex);
    });

    it("mantém o step 'Registrar o resultado no Linear' rodando com if: always()", () => {
      const workflow = readWorkflow(file);
      const commentStep = extractStepBlock(
        workflow,
        "Registrar o resultado no Linear"
      );

      expect(commentStep).toContain("if: always()");
    });

    it("nunca interpola ${{ inputs.issue_key }} dentro do bloco run: do step novo", () => {
      const workflow = readWorkflow(file);
      const noDiffStep = extractStepBlock(
        workflow,
        "Falhar quando o agente não produziu alteração"
      );

      const runIndex = noDiffStep.indexOf("run:");
      expect(runIndex).toBeGreaterThan(-1);

      const envBlock = noDiffStep.slice(0, runIndex);
      const runBlock = noDiffStep.slice(runIndex);

      expect(envBlock).toContain("${{ inputs.issue_key }}");
      expect(runBlock).not.toContain("${{ inputs.issue_key }}");
    });

    it(`step de "Falhar quando o agente não produziu alteração" tem if: always() (${agent})`, () => {
      const workflow = readWorkflow(file);
      const noDiffStep = extractStepBlock(
        workflow,
        "Falhar quando o agente não produziu alteração"
      );

      expect(noDiffStep).toContain("if: always()");
    });
  }
);

describe.each(WORKFLOWS)(
  "$file: falha visível quando há diff sem PR",
  ({ file }) => {
    const stepName = "Falhar quando houve alteração mas nenhum PR foi aberto";

    it("falha quando houve alteração e o step de PR não produziu URL", () => {
      const workflow = readWorkflow(file);
      const noPrStep = extractStepBlock(workflow, stepName);

      expect(noPrStep).toContain("if: always()");
      expect(noPrStep).toContain("steps.diff.outputs.changed == 'true'");
      expect(noPrStep).toContain("steps.pr.outputs.url == ''");
      expect(noPrStep).toContain("exit 1");
      expect(noPrStep).toContain("::error");
    });

    it("executa a pós-condição depois do comentário no Linear", () => {
      const stepNames = extractStepNames(readWorkflow(file));
      const commentIndex = stepNames.indexOf("Registrar o resultado no Linear");
      const failIndex = stepNames.indexOf(stepName);

      expect(commentIndex).toBeGreaterThanOrEqual(0);
      expect(failIndex).toBeGreaterThan(commentIndex);
    });

    it("não interpola inputs.issue_key dentro do bloco run", () => {
      const noPrStep = extractStepBlock(readWorkflow(file), stepName);
      const runIndex = noPrStep.indexOf("run:");
      const envBlock = noPrStep.slice(0, runIndex);
      const runBlock = noPrStep.slice(runIndex);

      expect(runIndex).toBeGreaterThan(-1);
      expect(envBlock).toContain("${{ inputs.issue_key }}");
      expect(runBlock).not.toContain("${{ inputs.issue_key }}");
    });
  }
);

describe.each(WORKFLOWS)(
  "$file: ordem dentro do step 'Verificar se houve alteração'",
  ({ file }) => {
    it("remove .dispatch antes de checar git status --porcelain", () => {
      const workflow = readWorkflow(file);
      const diffStep = extractStepBlock(workflow, "Verificar se houve alteração");

      const rmIndex = diffStep.indexOf("rm -rf .dispatch");
      const statusIndex = diffStep.indexOf("git status --porcelain");

      expect(rmIndex).toBeGreaterThan(-1);
      expect(statusIndex).toBeGreaterThan(-1);
      expect(rmIndex).toBeLessThan(statusIndex);
    });
  }
);

describe("dispatch-codex.yml: preservação do relatório do agente", () => {
  const file = "dispatch-codex.yml";

  it("existe o step 'Preservar o relatório do agente' antes de 'Verificar se houve alteração'", () => {
    const workflow = readWorkflow(file);
    const stepNames = extractStepNames(workflow);

    const preserveIndex = stepNames.indexOf("Preservar o relatório do agente");
    const diffIndex = stepNames.indexOf("Verificar se houve alteração");

    expect(preserveIndex).toBeGreaterThanOrEqual(0);
    expect(diffIndex).toBeGreaterThanOrEqual(0);
    expect(preserveIndex).toBeLessThan(diffIndex);
  });

  it("o run: do step referencia $RUNNER_TEMP e nunca escreve em .dispatch/", () => {
    const workflow = readWorkflow(file);
    const preserveStep = extractStepBlock(
      workflow,
      "Preservar o relatório do agente"
    );

    expect(preserveStep).toContain("$RUNNER_TEMP");
    expect(preserveStep).not.toContain(".dispatch/");
  });

  it("roda com if: always()", () => {
    const workflow = readWorkflow(file);
    const preserveStep = extractStepBlock(
      workflow,
      "Preservar o relatório do agente"
    );

    expect(preserveStep).toContain("if: always()");
  });

  it("o guard 'sem diff' referencia $RUNNER_TEMP/agent-report.md e escreve em $GITHUB_STEP_SUMMARY", () => {
    const workflow = readWorkflow(file);
    const noDiffStep = extractStepBlock(
      workflow,
      "Falhar quando o agente não produziu alteração"
    );

    expect(noDiffStep).toContain("$RUNNER_TEMP/agent-report.md");
    expect(noDiffStep).toContain("$GITHUB_STEP_SUMMARY");
  });

  it("${{ steps.codex.outputs.final-message }} só aparece em posição de env:, nunca dentro do run:", () => {
    const workflow = readWorkflow(file);
    const preserveStep = extractStepBlock(
      workflow,
      "Preservar o relatório do agente"
    );

    const runIndex = preserveStep.indexOf("run:");
    expect(runIndex).toBeGreaterThan(-1);

    const envBlock = preserveStep.slice(0, runIndex);
    const runBlock = preserveStep.slice(runIndex);

    expect(envBlock).toContain("${{ steps.codex.outputs.final-message }}");
    expect(runBlock).not.toContain("${{ steps.codex.outputs.final-message }}");
  });
});
