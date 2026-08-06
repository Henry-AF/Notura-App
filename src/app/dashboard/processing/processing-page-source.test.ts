import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProcessingPage(): string {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/processing/page.tsx"),
    "utf8"
  );
}

describe("processing page source", () => {
  it("redirects old processing links to the meeting details page", () => {
    const source = readProcessingPage();

    expect(source).toContain("router.replace");
    expect(source).toContain("meetingId ? `/dashboard/meetings/${meetingId}`");
    expect(source).toContain('"/dashboard"');
    expect(source).toContain("useSearchParams");
    expect(source).toContain("Suspense");
    expect(source).not.toMatch(/router\.(?:push|replace)\([^)]*\/dashboard\/processing/);
  });

  it("no longer renders the retired processing UI", () => {
    const source = readProcessingPage();

    expect(source).not.toContain("processingStep");
    expect(source).not.toContain("fetchMeetingStatus");
    expect(source).not.toContain("AnimatedWaveform");
    expect(source).not.toContain("SpinningRing");
  });
});
