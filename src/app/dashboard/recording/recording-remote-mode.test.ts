import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("recording page remote mode", () => {
  it("routes presencial and remote starts through the matching recording capture", () => {
    const source = readSource("src/app/dashboard/recording/page.tsx");

    expect(source).toContain("createMicrophoneRecordingCapture");
    expect(source).toContain("createRemoteMeetingRecordingCapture");
    expect(source).toContain("RemoteDisplayAudioMissingError");
    expect(source).toContain('values.recordingMode === "remote"');
    expect(source).toContain("captureCleanupRef");
  });
});
