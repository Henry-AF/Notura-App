// One-off generator for src/lib/docx/templates/default-ata.docx.
//
// There is no Word-editing tool available in this environment, so the
// default ATA template is built directly as a minimal, valid OOXML .docx
// package (via PizZip) instead of being authored in Word. It contains one
// paragraph per section with the placeholders from
// src/lib/docx/placeholders.ts (ALLOWED_PLACEHOLDERS) using docxtemplater's
// default `{tag}` / `{#loop}...{/loop}` syntax. Re-run this script with
// `node scripts/generate-default-ata-template.mjs` if the template needs to
// be regenerated.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import PizZip from "pizzip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "docx",
  "templates",
  "default-ata.docx"
);

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function paragraph(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

const paragraphs = [
  paragraph("ATA DE REUNIÃO"),
  paragraph("{meeting_title}"),
  paragraph("Data: {meeting_date}"),
  paragraph("Participantes: {#participants}{name}; {/participants}"),
  paragraph("Objetivo"),
  paragraph("{objective}"),
  paragraph("Resumo Executivo"),
  paragraph("{executive_summary}"),
  paragraph("Tópicos Discutidos"),
  paragraph("{#topics}{title}: {content}; {/topics}"),
  paragraph("Decisões"),
  paragraph("{#decisions}{description} (Responsável: {decided_by}); {/decisions}"),
  paragraph("Tarefas"),
  paragraph(
    "{#tasks}{description} - Responsável: {owner} - Prazo: {due_date}; {/tasks}"
  ),
  paragraph("Próximos Passos"),
  paragraph("{next_steps}"),
];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${paragraphs.join("\n")}
<w:sectPr/>
</w:body>
</w:document>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypesXml);
zip.file("_rels/.rels", rootRelsXml);
zip.file("word/document.xml", documentXml);

const buffer = zip.generate({ type: "nodebuffer" });
writeFileSync(outputPath, buffer);

console.log(`Wrote ${outputPath} (${buffer.length} bytes)`);
