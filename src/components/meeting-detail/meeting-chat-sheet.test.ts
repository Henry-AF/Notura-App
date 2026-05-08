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

  it("lets the archived chats sheet ask a new question for the selected meeting", () => {
    const source = readSource();

    expect(source).toContain("meetingId: string;");
    expect(source).toContain("createMeetingChat(meetingId, trimmed)");
    expect(source).toContain("waitForMeetingChat(meetingId, chatId)");
    expect(source).not.toContain(
      "Chats arquivados ficam em modo somente leitura dentro desta reunião."
    );
  });
});
