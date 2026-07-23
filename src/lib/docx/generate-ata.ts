import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { AtaData } from "@/lib/docx/meeting-ata-data";

export class InvalidAtaTemplateError extends Error {
  constructor(message = "Modelo de ata inválido ou corrompido.") {
    super(message);
    this.name = "InvalidAtaTemplateError";
  }
}

export function renderAtaDocx(templateBuffer: Buffer, data: AtaData): Buffer {
  let zip: PizZip;
  try {
    zip = new PizZip(templateBuffer);
  } catch {
    throw new InvalidAtaTemplateError();
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  try {
    doc.render(data);
  } catch (error) {
    throw new InvalidAtaTemplateError(
      `Falha ao renderizar a ata: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`
    );
  }

  return doc.getZip().generate({ type: "nodebuffer" });
}
