import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { InvalidAtaTemplateError, renderAtaDocx } from "./generate-ata";
import type { AtaData } from "./meeting-ata-data";

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  "templates",
  "default-ata.docx"
);

function loadDefaultTemplate(): Buffer {
  return readFileSync(DEFAULT_TEMPLATE_PATH);
}

const fullData: AtaData = {
  meeting_title: "Reunião de Alinhamento",
  meeting_date: "07 abr. 2026",
  participants: [{ name: "Ana" }, { name: "Bruno" }],
  objective: "Alinhar o roadmap do trimestre.",
  executive_summary: "Discussão sobre o roadmap e prioridades.",
  topics: [{ title: "Roadmap", content: "Definição das prioridades do Q2." }],
  decisions: [{ description: "Adotar o plano premium", decided_by: "Ana" }],
  tasks: [
    { description: "Enviar proposta", owner: "Bruno", due_date: "10 abr. 2026" },
  ],
  next_steps: "Agendar reunião de follow-up.",
};

const emptyData: AtaData = {
  meeting_title: "Reunião sem dados",
  meeting_date: "07 abr. 2026",
  participants: [],
  objective: "",
  executive_summary: "",
  topics: [],
  decisions: [],
  tasks: [],
  next_steps: "",
};

describe("renderAtaDocx", () => {
  it("renders the real default template into a valid docx/zip buffer", () => {
    const template = loadDefaultTemplate();
    const result = renderAtaDocx(template, fullData);

    expect(result.subarray(0, 2).toString()).toBe("PK");

    const zip = new PizZip(result);
    expect(() => zip.file("word/document.xml")?.asText()).not.toThrow();
    const documentXml = zip.file("word/document.xml")?.asText() ?? "";
    expect(documentXml).toContain("Enviar proposta");
    expect(documentXml).toContain("Alinhar o roadmap do trimestre.");
  });

  it("renders successfully when every loop section is empty", () => {
    const template = loadDefaultTemplate();
    const result = renderAtaDocx(template, emptyData);

    expect(result.subarray(0, 2).toString()).toBe("PK");
    const zip = new PizZip(result);
    expect(zip.file("word/document.xml")).not.toBeNull();
  });

  it("throws InvalidAtaTemplateError for a corrupted template buffer", () => {
    expect(() => renderAtaDocx(Buffer.from("not a zip"), emptyData)).toThrow(
      InvalidAtaTemplateError
    );
  });
});
