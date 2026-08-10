import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readMobileSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("dedicated mobile processing route", () => {
  it("receives the post-upload handoff instead of meeting detail", () => {
    const recordSource = readMobileSource("app/(app)/record.tsx");

    expect(recordSource).toContain("router.replace(`/(app)/processing/${meetingId}`)");
    expect(recordSource).not.toContain("router.replace(`/(app)/meetings/${meetingId}`)");
  });

  it("owns polling and redirects to detail only after completion", () => {
    const processingSource = readMobileSource("app/(app)/processing/[id].tsx");

    expect(processingSource).toContain("setInterval");
    expect(processingSource).toContain('next.status === "completed"');
    expect(processingSource).toContain("router.replace(getMeetingDetailRoute(id))");
    expect(processingSource).toContain("<ProcessingState");
  });

  it("keeps meeting detail resilient to pending or processing entries", () => {
    const detailSource = readMobileSource("app/(app)/meetings/[id].tsx");

    expect(detailSource).toContain('effectiveStatus !== "processing"');
    expect(detailSource).toContain('effectiveStatus !== "pending"');
    expect(detailSource).toContain("<ProcessingState");
  });
});
