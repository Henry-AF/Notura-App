import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("recording page upload mode", () => {
  it("extracts a dedicated upload panel for recording mode", () => {
    const pageSource = readSource("src/app/dashboard/recording/page.tsx");
    const setupSource = readSource(
      "src/components/recording/RecordingSetupCard.tsx"
    );
    const dropZoneSource = readSource("src/components/upload/DropZone.tsx");

    expect(pageSource).toContain("submitUploadedMeeting");
    expect(pageSource).toContain("UploadProgressCard");
    expect(pageSource).toContain("handleFile");
    expect(setupSource).toContain("uploadField");
    expect(setupSource).toContain("Data da reunião");
    expect(dropZoneSource).toContain("compact");
  });

  it("supports mode=upload in the recording page", () => {
    const source = readSource("src/app/dashboard/recording/page.tsx");

    expect(source).toContain('getInitialRecordingMode(searchParams.get("mode"))');
    expect(source).toContain('recordingMode === "upload"');
    expect(source).toContain('lg:flex-row');
    expect(source).toContain('lg:w-[340px]');
    expect(source).toContain('px-4 pb-8 pt-7 sm:px-6 sm:pb-14 sm:pt-10');
    expect(source).not.toContain("Informações da Reunião");
  });

  it("routes upload shortcuts to recording?mode=upload", () => {
    const dashboardSource = readSource(
      "src/app/dashboard/dashboard-client.tsx"
    );
    const layoutSource = readSource(
      "src/app/dashboard/dashboard-layout-client.tsx"
    );
    const processingSource = readSource(
      "src/app/dashboard/processing/page.tsx"
    );

    expect(dashboardSource).toContain("/dashboard/recording?mode=upload");
    expect(layoutSource).toContain("/dashboard/recording?mode=upload");
    expect(processingSource).toContain("/dashboard/recording?mode=upload");
  });
});
