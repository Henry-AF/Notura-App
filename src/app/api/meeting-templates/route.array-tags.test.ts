import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import PizZip from "pizzip";
import { beforeEach, describe, expect, it, vi } from "vitest";

// This file deliberately does NOT mock @/lib/docx/placeholders. It exercises
// the real Docxtemplater inspection (extractTemplateTags, extractStructuredTags,
// validateTemplateTags) against real .docx buffers, end-to-end through the
// route handler. This is the non-regression proof for NOT-131: an array
// placeholder (participants/topics/decisions/tasks) used as a scalar must be
// rejected, while the real default-ata.docx template (all array tags as
// correct loops) must keep working.

const mocks = vi.hoisted(() => ({
  requireCustomTemplateAccess: vi.fn(),
  createTemplate: vi.fn(),
  buildTemplateR2Key: vi.fn(),
  uploadAudio: vi.fn(),
  withAuthRateLimit: vi.fn((_policy, handler) => {
    return (request: Request, context: Record<string, unknown>) =>
      handler(request, {
        ...context,
        auth: {
          user: { id: "user-1" },
          supabaseAdmin: { from: vi.fn() },
        },
      });
  }),
}));

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: mocks.withAuthRateLimit,
}));

vi.mock("@/lib/billing/custom-template-access", () => ({
  requireCustomTemplateAccess: mocks.requireCustomTemplateAccess,
  CustomTemplateProRequiredError: class CustomTemplateProRequiredError extends Error {
    readonly status = 403;
  },
}));

vi.mock("@/lib/meeting-templates", () => ({
  MeetingTemplateValidationError: class MeetingTemplateValidationError extends Error {},
  createTemplate: mocks.createTemplate,
  listTemplatesForUser: vi.fn(),
}));

vi.mock("@/lib/r2", () => ({
  buildTemplateR2Key: mocks.buildTemplateR2Key,
  uploadAudio: mocks.uploadAudio,
}));

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "lib",
  "docx",
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

function buildUploadRequest(fields: { file?: File | string; name?: string }) {
  const formData = new FormData();
  if (fields.file !== undefined) formData.append("file", fields.file);
  if (fields.name !== undefined) formData.append("name", fields.name);

  return new Request("http://localhost/api/meeting-templates", {
    method: "POST",
    body: formData,
  }) as NextRequest;
}

describe("POST /api/meeting-templates — real docx array-tag validation (NOT-131)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireCustomTemplateAccess.mockResolvedValue({
      canUseCustomTemplates: true,
      plan: "team",
    });
    mocks.buildTemplateR2Key.mockReturnValue("templates/user-1/123/template.docx");
    mocks.uploadAudio.mockResolvedValue(undefined);
    mocks.createTemplate.mockResolvedValue({
      id: "template-1",
      user_id: "user-1",
      name: "Meu modelo",
      r2_key: "templates/user-1/123/template.docx",
      original_filename: "template.docx",
      placeholders: ["meeting_title", "participants"],
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    });
  });

  it("returns 422 when an array tag is used as a scalar placeholder instead of a loop", async () => {
    const buffer = buildDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>{meeting_title}</w:t></w:r></w:p>
<w:p><w:r><w:t>{participants}</w:t></w:r></w:p>
</w:body>
</w:document>`
    );
    const file = new File([new Uint8Array(buffer)], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const mod = await import("./route");
    const response = await mod.POST(buildUploadRequest({ file, name: "Meu modelo" }), {
      params: {},
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatch(/participants/);
    expect(body.error).toMatch(/lista/i);
    expect(body.invalidScalarArrayTags).toEqual(["participants"]);
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("returns 201 for the real default-ata.docx template — all array tags are correct loops (non-regression)", async () => {
    const buffer = readFileSync(DEFAULT_TEMPLATE_PATH);
    const file = new File([new Uint8Array(buffer)], "default-ata.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const mod = await import("./route");
    const response = await mod.POST(buildUploadRequest({ file, name: "Meu modelo" }), {
      params: {},
    });

    expect(response.status).toBe(201);
    expect(mocks.uploadAudio).toHaveBeenCalled();
    expect(mocks.createTemplate).toHaveBeenCalled();
  });
});
