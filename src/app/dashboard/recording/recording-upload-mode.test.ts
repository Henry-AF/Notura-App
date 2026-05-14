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
    const layoutSource = readSource(
      "src/app/dashboard/dashboard-layout-client.tsx"
    );
    const rootLayoutSource = readSource("src/app/layout.tsx");

    expect(source).toContain('getInitialRecordingMode(searchParams.get("mode"))');
    expect(source).toContain('recordingMode === "upload"');
    expect(source).toContain('lg:flex-row');
    expect(source).toContain('lg:w-[340px]');
    expect(source).toContain("sm:pb-14 sm:pt-10");
    expect(source).not.toContain('document.querySelector("main")');
    expect(source).not.toContain('main.scrollTo({ top: 0, behavior: "auto" })');
    expect(layoutSource).toContain("fixed inset-0 flex overflow-hidden");
    expect(layoutSource).toContain("flex min-h-0 flex-1 flex-col overflow-hidden");
    expect(layoutSource).toContain("min-h-0 flex-1 overflow-y-auto overscroll-y-contain");
    expect(layoutSource).not.toContain("overscroll-y-none");
    expect(rootLayoutSource).toContain("min-h-dvh");
    expect(rootLayoutSource).not.toContain("min-h-screen");
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
