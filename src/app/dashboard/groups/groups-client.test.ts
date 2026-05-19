import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/groups/groups-client.tsx"),
    "utf8"
  );
}

describe("groups client presentation", () => {
  it("renders the selected group meetings with the shared dashboard list section", () => {
    const source = readSource();

    expect(source).toContain("DashboardListSection");
    expect(source).toContain("Grupo:");
    expect(source).toContain("Adicionar reuniao");
    expect(source).toContain('title="Grupo vazio"');
    expect(source).toContain('title="Selecione um grupo"');
  });

  it("keeps group panels constrained on mobile widths", () => {
    const source = readSource();

    expect(source).toContain('className="grid min-w-0 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"');
    expect(source).toContain('className="min-w-0"');
    expect(source).toContain('className="min-w-0 overflow-hidden"');
    expect(source).toContain('className="h-10 w-full min-w-0 rounded-lg sm:min-w-[220px]"');
  });
});
