import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GUARDED_FILES = [
  "src/app/(auth)/login/page.tsx",
  "src/app/(auth)/signup/page.tsx",
  "src/app/dashboard/meetings/page.tsx",
  "src/components/auth/AuthShell.tsx",
  "src/components/meeting-detail/MeetingHeader.tsx",
  "src/components/meeting-detail/SmartSummaryCard.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/ui/toast.tsx",
];

describe("frontend inline-style guard", () => {
  it("avoids inline style props in migrated design-system files", () => {
    for (const filePath of GUARDED_FILES) {
      const source = readFileSync(resolve(process.cwd(), filePath), "utf8");
      expect(source, filePath).not.toContain("style={{");
    }
  });
});
