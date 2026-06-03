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
    expect(pageSource).toContain("canSendWhatsAppSummary");
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
    const processingSource = readSource(
      "src/app/dashboard/processing/page.tsx"
    );

    expect(dashboardSource).toContain("/dashboard/recording?mode=upload");
    expect(processingSource).toContain("/dashboard/recording?mode=upload");
  });

  it("warns before leaving upload mode with a selected file", () => {
    const source = readSource("src/app/dashboard/recording/page.tsx");

    expect(source).toContain("Você perderá o arquivo selecionado se sair agora.");
    expect(source).toContain("handlePageClickCapture");
    expect(source).toContain('document.addEventListener("click"');
    expect(source).toContain("beforeunload");
    expect(source).toContain("pendingNavigationHref");
    expect(source).toContain("window.location.assign");
    expect(source).toContain("upload-leave-modal-panel");
    expect(source).toContain("fixed inset-0 z-[200] flex items-end justify-center");
    expect(source).toContain("sm:items-center");
    expect(source).not.toContain("DialogContent");
    expect(source).toContain("Continuar e sair");
  });

  it("loads and revalidates meeting quota before recording or upload starts", () => {
    const source = readSource("src/app/dashboard/recording/page.tsx");
    const apiSource = readSource("src/app/dashboard/recording/recording-api.ts");

    expect(apiSource).toContain("fetchRecordingQuotaGate");
    expect(source).toContain("canProcessMeetings");
    expect(source).toContain("meetingQuotaMessage");
    expect(source).toContain("ensureCanProcessMeetings");
    expect(source).toContain("await ensureCanProcessMeetings()");
    expect(source).toContain("disabled={isQuotaBlocked}");
    expect(source).toContain("setupCapabilities");
  });
});
