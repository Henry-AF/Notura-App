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
    expect(meetingDetailClient).not.toContain("AIInsightToast");
    expect(meetingChatSheet).not.toContain('aria-label="Abrir análise com IA"');
    expect(meetingChatSheet).not.toContain("position: fixed");
    expect(meetingDetailIndex).not.toContain("AIInsightToast");
  });
});
