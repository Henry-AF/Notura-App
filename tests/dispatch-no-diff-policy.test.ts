import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = ".github/workflows/dispatch-claude-code.yml";

function readWorkflow() {
  return readFileSync(WORKFLOW_PATH, "utf8");
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

describe("dispatch-claude-code: falha visível quando não há diff", () => {
  it("contém um step que falha explicitamente quando steps.diff.outputs.changed == 'false'", () => {
    const workflow = readWorkflow();
    const noDiffStep = extractStepBlock(
      workflow,
      "Falhar quando o agente não produziu alteração"
    );

    expect(noDiffStep).toContain("steps.diff.outputs.changed == 'false'");
    expect(noDiffStep).toContain("exit 1");
    expect(noDiffStep).toContain("::error");
  });

  it("posiciona o step de falha depois do step que comenta no Linear", () => {
    const workflow = readWorkflow();
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
    const workflow = readWorkflow();
    const commentStep = extractStepBlock(
      workflow,
      "Registrar o resultado no Linear"
    );

    expect(commentStep).toContain("if: always()");
  });

  it("nunca interpola ${{ inputs.issue_key }} dentro do bloco run: do step novo", () => {
    const workflow = readWorkflow();
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
});
