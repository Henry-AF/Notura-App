import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("meeting detail actions", () => {
  it("moves chat access into the header and removes meeting-specific floating buttons", () => {
    const meetingHeader = readSource("src/components/meeting-detail/MeetingHeader.tsx");
    const meetingDetailClient = readSource(
      "src/app/dashboard/meetings/[id]/meeting-detail-client.tsx"
    );
    const meetingChatSheet = readSource(
      "src/components/meeting-detail/MeetingChatSheet.tsx"
    );
    const meetingDetailIndex = readSource("src/components/meeting-detail/index.ts");

    expect(meetingHeader).toContain("Chat");
    expect(meetingHeader).toContain("bg-[linear-gradient(135deg,rgba(94,76,235,0.92)_0%,rgba(59,130,246,0.82)_100%)]");
    expect(meetingDetailClient).not.toContain("AIInsightToast");
    expect(meetingChatSheet).not.toContain('aria-label="Abrir análise com IA"');
    expect(meetingChatSheet).not.toContain("position: fixed");
    expect(meetingDetailIndex).not.toContain("AIInsightToast");
    expect(meetingChatSheet).not.toContain(
      'if (feedback !== "up") (e.currentTarget as HTMLButtonElement).style.color = feedback === "up" ? "#10B981" : "#9CA3AF";'
    );
    expect(meetingChatSheet).not.toContain(
      'if (feedback !== "down") (e.currentTarget as HTMLButtonElement).style.color = feedback === "down" ? "#EF4444" : "#9CA3AF";'
    );
  });
});
