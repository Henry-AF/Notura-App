import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(file: string) {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

describe("dashboard list section", () => {
  it("defines a reusable shared list wrapper for dashboard pages", () => {
    const source = readSource("src/components/ui/app/dashboard-list-section.tsx");
    const barrel = readSource("src/components/ui/app/index.ts");

    expect(source).toContain("export interface DashboardListSectionProps");
    expect(source).toContain("actions?: React.ReactNode");
    expect(source).toContain("emptyState?: React.ReactNode");
    expect(source).toContain("header?: React.ReactNode");
    expect(source).toContain("children: React.ReactNode");
    expect(source).toContain("SectionCard");
    expect(source).toContain("header ? (");
    expect(source).toContain("emptyState");
    expect(source).toContain("min-w-0 max-w-full");
    expect(source).toContain("w-full min-w-0 sm:w-auto");
    expect(barrel).toContain('export { DashboardListSection } from "./dashboard-list-section";');
  });
});
