import { readFileSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_PLACEHOLDERS,
  extractStructuredTags,
  extractTemplateTags,
  validateTemplateTags,
} from "./placeholders";

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  "templates",
  "default-ata.docx"
);

function buildDocxBuffer(documentXml: string): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer" });
}

describe("extractTemplateTags", () => {
  it("extracts every top-level tag from the real default template", () => {
    const buffer = readFileSync(DEFAULT_TEMPLATE_PATH);
    const tags = extractTemplateTags(buffer);

    expect(tags.sort()).toEqual([...ALLOWED_PLACEHOLDERS].sort());
  });

  it("extracts tags from a custom template, ignoring unknown ones", () => {
    const buffer = buildDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>{meeting_title}</w:t></w:r></w:p>
<w:p><w:r><w:t>{budget_forecast}</w:t></w:r></w:p>
</w:body>
</w:document>`
    );

    const tags = extractTemplateTags(buffer);
    expect(tags).toEqual(expect.arrayContaining(["meeting_title", "budget_forecast"]));
  });
});

describe("extractStructuredTags", () => {
  it("marks array placeholders used as a loop block with module: loop", () => {
    const buffer = readFileSync(DEFAULT_TEMPLATE_PATH);
    const structuredTags = extractStructuredTags(buffer);

    for (const tag of ["participants", "topics", "decisions", "tasks"]) {
      const part = structuredTags.find((p) => p.value === tag);
      expect(part?.module).toBe("loop");
    }
  });

  it("does not set module: loop for a scalar placeholder", () => {
    const buffer = buildDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>{participants}</w:t></w:r></w:p>
</w:body>
</w:document>`
    );

    const structuredTags = extractStructuredTags(buffer);
    const part = structuredTags.find((p) => p.value === "participants");
    expect(part?.module).toBeUndefined();
  });
});

describe("validateTemplateTags", () => {
  it("marks the real default template as valid — all array tags are loops (non-regression)", () => {
    const buffer = readFileSync(DEFAULT_TEMPLATE_PATH);
    const tags = extractTemplateTags(buffer);
    const structuredTags = extractStructuredTags(buffer);

    const result = validateTemplateTags(tags, structuredTags);

    expect(result).toEqual({
      valid: true,
      unknown: [],
      hasNoTags: false,
      invalidScalarArrayTags: [],
    });
  });

  it("reports unknown tags without touching the known ones", () => {
    const buffer = buildDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>{meeting_title}</w:t></w:r></w:p>
<w:p><w:r><w:t>{budget_forecast}</w:t></w:r></w:p>
<w:p><w:r><w:t>{logo_url}</w:t></w:r></w:p>
</w:body>
</w:document>`
    );
    const tags = extractTemplateTags(buffer);
    const structuredTags = extractStructuredTags(buffer);

    const result = validateTemplateTags(tags, structuredTags);
    expect(result.valid).toBe(false);
    expect(result.unknown).toEqual(["budget_forecast", "logo_url"]);
    expect(result.hasNoTags).toBe(false);
    expect(result.invalidScalarArrayTags).toEqual([]);
  });

  it("marks a template with zero recognized tags as invalid (NOT-130)", () => {
    const result = validateTemplateTags([], []);
    expect(result).toEqual({
      valid: false,
      unknown: [],
      hasNoTags: true,
      invalidScalarArrayTags: [],
    });
  });

  it("marks an array placeholder used as a scalar (not a loop) as invalid (NOT-131)", () => {
    const buffer = buildDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>{meeting_title}</w:t></w:r></w:p>
<w:p><w:r><w:t>{participants}</w:t></w:r></w:p>
</w:body>
</w:document>`
    );
    const tags = extractTemplateTags(buffer);
    const structuredTags = extractStructuredTags(buffer);

    const result = validateTemplateTags(tags, structuredTags);

    expect(result.valid).toBe(false);
    expect(result.invalidScalarArrayTags).toEqual(["participants"]);
    expect(result.unknown).toEqual([]);
    expect(result.hasNoTags).toBe(false);
  });

  it("reports only the array tag used incorrectly when the other three are correct loops", () => {
    const buffer = buildDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>{#participants}{name}{/participants}</w:t></w:r></w:p>
<w:p><w:r><w:t>{topics}</w:t></w:r></w:p>
<w:p><w:r><w:t>{#decisions}{description}{/decisions}</w:t></w:r></w:p>
<w:p><w:r><w:t>{#tasks}{description}{/tasks}</w:t></w:r></w:p>
</w:body>
</w:document>`
    );
    const tags = extractTemplateTags(buffer);
    const structuredTags = extractStructuredTags(buffer);

    const result = validateTemplateTags(tags, structuredTags);

    expect(result.invalidScalarArrayTags).toEqual(["topics"]);
    expect(result.valid).toBe(false);
  });
});
