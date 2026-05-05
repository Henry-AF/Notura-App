import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED_IMPORT_PATTERN = /from\s+["']@\/components\/ui\/app["']/;
const FRAME_PANEL_CLASS = "fixed right-0 top-0 z-50 flex h-full w-[420px]";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AppSideSheet shared frame", () => {
  it("is reused by meeting chat and AI chat history sheets", () => {
    const meetingChatSheet = readSource(
      "src/components/meeting-detail/MeetingChatSheet.tsx"
    );
    const aiChatSheet = readSource(
      "src/app/dashboard/ai-chats/ai-chats-client.tsx"
    );

    expect(meetingChatSheet).toMatch(SHARED_IMPORT_PATTERN);
    expect(meetingChatSheet).toContain("AppSideSheet");
    expect(meetingChatSheet).not.toContain(FRAME_PANEL_CLASS);

    expect(aiChatSheet).toMatch(SHARED_IMPORT_PATTERN);
    expect(aiChatSheet).toContain("AppSideSheet");
    expect(aiChatSheet).not.toContain(FRAME_PANEL_CLASS);
  });

  it("anchors the overlay and panel to the viewport instead of page content", () => {
    const source = readSource("src/components/ui/app/side-sheet.tsx");

    expect(source).toContain("createPortal");
    expect(source).toContain("document.body");
    expect(source).toContain("fixed inset-0");
    expect(source).toContain("fixed right-0 top-0");
    expect(source).toContain("h-dvh");
    expect(source).not.toContain("h-full w-[420px]");
  });
});
