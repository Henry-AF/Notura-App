import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/meetings/meetings-client.tsx"),
    "utf8"
  );
}

describe("meetings client presentation", () => {
  it("keeps the primary new meeting action in the page header", () => {
    const source = readSource();

    expect(source).toContain('title="Reuniões"');
    expect(source).toContain("actions={");
    expect(source).toContain('href="/dashboard/recording"');
    expect(source).toContain("Nova reunião");
  });

  it("renders the meetings table through the shared dashboard list wrapper", () => {
    const source = readSource();

    expect(source).toContain("DashboardListSection");
    expect(source).toContain("<p>Título</p>");
    expect(source).toContain('placeholder="Buscar por título..."');
    expect(source).toContain("<p>Data</p>");
    expect(source).toContain("<p>Status</p>");
    expect(source).toContain('<p className="text-right">Ações</p>');
    expect(source).toContain('title="Nenhuma reunião encontrada"');
  });

  it("exposes a cancel action for meetings that are still processing", () => {
    const source = readSource();

    expect(source).toContain("cancelMeetingProcessing");
    expect(source).toContain('aria-label="Cancelar processamento"');
    expect(source).toContain('meeting.status === "processing"');
  });
});
