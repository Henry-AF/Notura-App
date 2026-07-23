import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  CustomTemplateProRequiredError: class CustomTemplateProRequiredError extends Error {
    readonly status = 403;
    constructor(message = "pro required") {
      super(message);
      this.name = "CustomTemplateProRequiredError";
    }
  },
  MeetingTemplateValidationError: class MeetingTemplateValidationError extends Error {
    constructor(message = "invalid") {
      super(message);
      this.name = "MeetingTemplateValidationError";
    }
  },
  requireCustomTemplateAccess: vi.fn(),
  extractTemplateTags: vi.fn(),
  extractStructuredTags: vi.fn(),
  validateTemplateTags: vi.fn(),
  createTemplate: vi.fn(),
  listTemplatesForUser: vi.fn(),
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
  CustomTemplateProRequiredError: mocks.CustomTemplateProRequiredError,
}));

vi.mock("@/lib/docx/placeholders", () => ({
  extractTemplateTags: mocks.extractTemplateTags,
  extractStructuredTags: mocks.extractStructuredTags,
  validateTemplateTags: mocks.validateTemplateTags,
}));

vi.mock("@/lib/meeting-templates", () => ({
  MeetingTemplateValidationError: mocks.MeetingTemplateValidationError,
  createTemplate: mocks.createTemplate,
  listTemplatesForUser: mocks.listTemplatesForUser,
}));

vi.mock("@/lib/r2", () => ({
  buildTemplateR2Key: mocks.buildTemplateR2Key,
  uploadAudio: mocks.uploadAudio,
}));

function buildZipLikeFile(name = "template.docx") {
  return new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])],
    name,
    { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
  );
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

describe("GET /api/meeting-templates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the templates for the authenticated user", async () => {
    mocks.listTemplatesForUser.mockResolvedValue([
      { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
    ]);

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: {},
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      templates: [
        { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
      ],
    });
    expect(mocks.listTemplatesForUser).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});

describe("POST /api/meeting-templates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.requireCustomTemplateAccess.mockResolvedValue({
      canUseCustomTemplates: true,
      plan: "team",
    });
    mocks.extractTemplateTags.mockReturnValue(["meeting_title", "objective"]);
    mocks.extractStructuredTags.mockReturnValue([]);
    mocks.validateTemplateTags.mockReturnValue({
      valid: true,
      unknown: [],
      hasNoTags: false,
      invalidScalarArrayTags: [],
    });
    mocks.buildTemplateR2Key.mockReturnValue("templates/user-1/123/template.docx");
    mocks.uploadAudio.mockResolvedValue(undefined);
    mocks.createTemplate.mockResolvedValue({
      id: "template-1",
      user_id: "user-1",
      name: "Meu modelo",
      r2_key: "templates/user-1/123/template.docx",
      original_filename: "template.docx",
      placeholders: ["meeting_title", "objective"],
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    });
  });

  it("returns 403 when the user is not on the Pro (team) plan", async () => {
    mocks.requireCustomTemplateAccess.mockRejectedValueOnce(
      new mocks.CustomTemplateProRequiredError("Somente Pro.")
    );

    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: buildZipLikeFile(), name: "Meu modelo" }),
      { params: {} }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Somente Pro." });
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
  });

  it("rejects files without a .docx extension", async () => {
    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: buildZipLikeFile("template.txt"), name: "Meu modelo" }),
      { params: {} }
    );

    expect(response.status).toBe(422);
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
  });

  it("rejects files without a valid zip signature", async () => {
    const invalidFile = new File(
      [new TextEncoder().encode("not a docx")],
      "template.docx"
    );

    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: invalidFile, name: "Meu modelo" }),
      { params: {} }
    );

    expect(response.status).toBe(422);
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
  });

  it("returns 422 and does not persist anything when placeholders are unknown", async () => {
    mocks.validateTemplateTags.mockReturnValue({
      valid: false,
      unknown: ["budget_forecast"],
      hasNoTags: false,
      invalidScalarArrayTags: [],
    });

    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: buildZipLikeFile(), name: "Meu modelo" }),
      { params: {} }
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "O modelo contém placeholders desconhecidos.",
      unknownPlaceholders: ["budget_forecast"],
    });
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("returns 422 with a clear message and does not persist anything when the template has zero recognized tags (NOT-130)", async () => {
    mocks.extractTemplateTags.mockReturnValue([]);
    mocks.validateTemplateTags.mockReturnValue({
      valid: false,
      unknown: [],
      hasNoTags: true,
      invalidScalarArrayTags: [],
    });

    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: buildZipLikeFile(), name: "TESTE" }),
      { params: {} }
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatch(/nenhum campo de mesclagem/i);
    expect(body.unknownPlaceholders).toBeUndefined();
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("returns 422 with a clear message and does not persist anything when an array tag is used as a scalar (NOT-131)", async () => {
    mocks.extractTemplateTags.mockReturnValue(["meeting_title", "participants"]);
    mocks.validateTemplateTags.mockReturnValue({
      valid: false,
      unknown: [],
      hasNoTags: false,
      invalidScalarArrayTags: ["participants"],
    });

    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: buildZipLikeFile(), name: "TESTE" }),
      { params: {} }
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatch(/participants/);
    expect(body.error).toMatch(/lista/i);
    expect(body.invalidScalarArrayTags).toEqual(["participants"]);
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("uploads to R2 and persists the template on a valid upload", async () => {
    const mod = await import("./route");
    const response = await mod.POST(
      buildUploadRequest({ file: buildZipLikeFile(), name: "Meu modelo" }),
      { params: {} }
    );

    expect(response.status).toBe(201);
    expect(mocks.uploadAudio).toHaveBeenCalledWith(
      "templates/user-1/123/template.docx",
      expect.any(Buffer),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(mocks.createTemplate).toHaveBeenCalledWith(expect.anything(), "user-1", {
      name: "Meu modelo",
      r2Key: "templates/user-1/123/template.docx",
      originalFilename: "template.docx",
      placeholders: ["meeting_title", "objective"],
    });
    expect(await response.json()).toEqual({
      template: {
        id: "template-1",
        user_id: "user-1",
        name: "Meu modelo",
        r2_key: "templates/user-1/123/template.docx",
        original_filename: "template.docx",
        placeholders: ["meeting_title", "objective"],
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
      },
    });
  });
});
