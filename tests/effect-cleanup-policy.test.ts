import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("effect cleanup policy", () => {
  it("cleans up the recording elapsed-time interval", () => {
    const source = readSource("src/components/recording/RecordingSessionProvider.tsx");

    expect(source).toContain("timerRef.current = setInterval(() => {");
    expect(source).toContain("return () => clearTimer();");
  });

  it("cleans up meeting chat focus timeouts", () => {
    const source = readSource("src/components/meeting-detail/MeetingChatSheet.tsx");

    expect(source.match(/const focusTimer = setTimeout/g) ?? []).toHaveLength(2);
    expect(source.match(/return \(\) => clearTimeout\(focusTimer\);/g) ?? []).toHaveLength(2);
  });

  it("cleans up the danger zone delete-modal focus timeout", () => {
    const source = readSource("src/components/settings/DangerZone.tsx");

    expect(source).toContain("const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);");
    expect(source).toContain("return () => clearTimeout(focusTimer);");
  });
});
