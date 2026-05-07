import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    resolve(process.cwd(), "src/components/meeting-detail/MeetingChatSheet.tsx"),
    "utf8"
  );
}

describe("meeting chat sheet presentation", () => {
  it("includes segmented navigation between new questions and archived chats", () => {
    const source = readSource();

    expect(source).toContain("Nova pergunta");
    expect(source).toContain("Chats arquivados");
    expect(source).toContain("aria-label=\"Voltar para lista de chats arquivados\"");
  });
});
