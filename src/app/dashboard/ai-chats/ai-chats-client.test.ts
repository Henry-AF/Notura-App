import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readClientSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/ai-chats/ai-chats-client.tsx"),
    "utf8"
  );
}

describe("ai chats client presentation", () => {
  it("renders status labels without status icons", () => {
    const source = readClientSource();

    expect(source).not.toContain("<AlertCircle");
    expect(source).not.toContain("<Check");
    expect(source).not.toContain("<Bot");
  });

  it("uses native browser titles for truncated meeting filter labels", () => {
    const source = readClientSource();

    expect(source).toContain('title="Todas as reuniões"');
    expect(source).toContain("title={option.label}");
  });

  it("avoids impossible feedback comparisons in hover handlers", () => {
    const source = readClientSource();

    expect(source).not.toContain(
      'if (feedback !== "down") (e.currentTarget as HTMLButtonElement).style.color = feedback === "down" ? "#EF4444" : "#9CA3AF";'
    );
    expect(source).not.toContain('aria-label="Resposta útil"');
  });

  it("reuses the shared archived meeting chat sheet instead of keeping a local one", () => {
    const source = readClientSource();

    expect(source).toContain("MeetingArchivedChatsSheet");
    expect(source).not.toContain("function AiChatSheet(");
  });

  it("passes the selected meeting id to the archived sheet so users can ask there", () => {
    const source = readClientSource();

    expect(source).toContain('meetingId={state.selectedChat?.meetingId ?? ""}');
  });
});
