import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const REPORT_LIMIT = 4000;

function extractClaudeReport(file) {
  if (!file || !existsSync(file)) return "";
  const events = JSON.parse(readFileSync(file, "utf8"));
  const result = events.find(
    (event) => event?.type === "result" && typeof event.result === "string"
  );
  if (result) return result.result;

  const assistant = events.findLast((event) => event?.type === "assistant");
  const content = assistant?.message?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function preserveReport() {
  const report =
    process.env.AGENT_REPORT || extractClaudeReport(process.env.AGENT_EXECUTION_FILE);
  if (report) writeFileSync(process.env.REPORT_PATH, report, "utf8");
}

function linearReportSection() {
  const section = reportSection();
  return section.replace("\n```\n", "\n").replace("\n```\n\n</details>", "\n</details>");
}

function writeLinearComment() {
  const { AGENT_NAME, CHANGED, COMMENT_PATH, PR_URL, RUN_URL } = process.env;
  let body;
  if (PR_URL) {
    body = `🤖 **${AGENT_NAME}** abriu um PR em draft: ${PR_URL}\n\nMerge continua manual, depois de CI verde e revisão. [Run](${RUN_URL})`;
  } else if (CHANGED === "false") {
    body = `🤖 **${AGENT_NAME}** rodou mas não alterou nenhum arquivo. Nenhum PR foi aberto e o job falhou. [Run](${RUN_URL})${linearReportSection()}`;
  } else {
    body = `🤖 **${AGENT_NAME}** falhou antes de abrir o PR. [Run](${RUN_URL})`;
  }
  writeFileSync(COMMENT_PATH, `${body}\n`, "utf8");
}

function reportSection() {
  const path = process.env.REPORT_PATH;
  if (!path || !existsSync(path)) return "";
  const report = readFileSync(path, "utf8").slice(0, REPORT_LIMIT);
  if (!report) return "";
  return `\n<details><summary>Relatório final do agente</summary>\n\n\`\`\`\n${report}\n\`\`\`\n\n</details>\n`;
}

function fail(title, message) {
  console.error(`::error title=${title}::${message}`);
  const summary = `### ${title}\n\n${message}\n${reportSection()}\n[Run](${process.env.RUN_URL})\n`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  process.exitCode = 1;
}

function validate() {
  const { AGENT_NAME, CHANGED, ISSUE_KEY, PR_URL } = process.env;
  if (CHANGED === "false") {
    fail(
      "Dispatch sem alteração",
      `${AGENT_NAME} rodou para ${ISSUE_KEY} e terminou sem alterar nenhum arquivo. Nenhum PR foi aberto.`
    );
  } else if (CHANGED === "true" && !PR_URL) {
    fail(
      "Dispatch sem PR",
      `${AGENT_NAME} alterou arquivos para ${ISSUE_KEY}, mas o fluxo terminou sem URL de PR.`
    );
  }
}

const command = process.argv[2];
if (command === "preserve") preserveReport();
else if (command === "comment") writeLinearComment();
else if (command === "validate") validate();
else throw new Error(`Comando desconhecido: ${command}`);
