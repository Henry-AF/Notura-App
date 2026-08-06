import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readDashboardSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), "src/app/dashboard", relativePath), "utf8");
}

function expectProcessingNavigationToUseMeetingDetail(source: string): void {
  expect(source).toContain(
    "onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}"
  );
  expect(source).not.toMatch(
    /onViewProcessing=\{\(id\) => router\.(?:push|replace)\(`\/dashboard\/processing/
  );
}

describe("processing meeting navigation", () => {
  it("opens meeting details from the meetings list", () => {
    const source = readDashboardSource("meetings/meetings-client.tsx");

    expect(source).toContain('meeting.status === "processing"');
    expectProcessingNavigationToUseMeetingDetail(source);
  });

  it("opens meeting details from the dashboard", () => {
    const source = readDashboardSource("dashboard-client.tsx");

    expect(source).toContain('status: "processing" as const');
    expectProcessingNavigationToUseMeetingDetail(source);
  });
});
