import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("recording page remote mode", () => {
  it("keeps live recording state in the persistent dashboard provider", () => {
    const source = readSource("src/app/dashboard/recording/page.tsx");
    const provider = readSource(
      "src/components/recording/RecordingSessionProvider.tsx"
    );
    const layout = readSource("src/app/dashboard/dashboard-layout-client.tsx");

    expect(source).toContain("useRecordingSession");
    expect(source).not.toContain("mediaRecorderRef");
    expect(source).not.toContain("recordedChunksRef");
    expect(source).not.toContain("createRecordingMediaRecorder");
    expect(source).not.toContain("cleanupRecorderResources");

    expect(layout).toContain("RecordingSessionProvider");
    expect(provider).toContain("createMicrophoneRecordingCapture");
    expect(provider).toContain("createRemoteMeetingRecordingCapture");
    expect(provider).toContain("RemoteDisplayAudioMissingError");
    expect(provider).toContain('values.recordingMode === "remote"');
    expect(provider).toContain("captureCleanupRef");
    expect(provider).toContain("RecordingOverlay");
  });
});
