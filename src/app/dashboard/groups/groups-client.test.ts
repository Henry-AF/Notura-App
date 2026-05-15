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
});
