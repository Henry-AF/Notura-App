import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = ".github/scripts/linear-dispatch.mjs";

function readScript(): string {
  return readFileSync(SCRIPT_PATH, "utf8");
}

function extractFunction(script: string, name: string): string {
  const start = script.indexOf(`async function ${name}`);
  const next = script.indexOf("\nasync function ", start + 1);

  if (start === -1) throw new Error(`Função ${name} não encontrada.`);
  return script.slice(start, next === -1 ? undefined : next);
}

describe("linear-dispatch: comentários idempotentes", () => {
  it("consulta comentário idêntico antes de criar um novo", () => {
    const command = extractFunction(readScript(), "commandComment");
    const checkIndex = command.indexOf("hasIdenticalComment(issue.id, body)");
    const createIndex = command.indexOf("commentCreate");

    expect(checkIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(checkIndex);
    expect(command).toContain("publicacao ignorada");
    expect(command).toContain("return;");
  });

  it("compara o corpo normalizado e percorre todas as páginas", () => {
    const script = readScript();
    const check = extractFunction(script, "hasIdenticalComment");
    const fetchPage = extractFunction(script, "fetchCommentPage");

    expect(check).toContain("body.trim()");
    expect(check).toContain("comment.body.trim() === expectedBody");
    expect(check).toContain("page.pageInfo.hasNextPage");
    expect(fetchPage).toContain("comments(first: 50, after: $after)");
    expect(fetchPage).toContain("pageInfo { hasNextPage endCursor }");
  });
});
