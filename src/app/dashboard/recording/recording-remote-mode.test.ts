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
    expect(provider).toContain("acquireRecordingWakeLock");
  });

  it("supports pausing, continuing, and resuming a stopped recording", () => {
    const provider = readSource(
      "src/components/recording/RecordingSessionProvider.tsx"
    );
    const overlay = readSource("src/components/recording/RecordingOverlay.tsx");

    expect(provider).toContain("isPaused");
    expect(provider).toContain("pauseRecording");
    expect(provider).toContain("resumePausedRecording");
    expect(provider).toContain("resumeStoppedRecording");
    expect(provider).toContain("recorder.pause()");
    expect(provider).toContain("recorder.resume()");
    expect(provider).toContain("recorder.requestData()");
    expect(provider).toContain('overlayStage !== "recording" || isPaused');
    expect(provider).not.toContain("preserveExistingChunks");

    expect(overlay).toContain("RecordingActionButton");
    expect(overlay).toContain("onPauseToggle");
    expect(overlay).toContain("onResumeRecording");
    expect(overlay).toContain("Pausar gravação");
    expect(overlay).toContain("Continuar gravação");
    expect(overlay).toContain("Retomar gravação");
  });

  it("does not say the recording was saved when saving fails", () => {
    const provider = readSource(
      "src/components/recording/RecordingSessionProvider.tsx"
    );

    expect(provider).not.toContain("Sua gravação foi salva");
    expect(provider).toContain("Não conseguimos salvar sua gravação");
  });
});
