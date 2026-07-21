import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  AtaExportPaidPlanRequiredError: class AtaExportPaidPlanRequiredError extends Error {
    readonly status = 403;
    constructor(message = "upgrade required") {
      super(message);
      this.name = "AtaExportPaidPlanRequiredError";
    }
  },
  CustomTemplateProRequiredError: class CustomTemplateProRequiredError extends Error {
    readonly status = 403;
    constructor(message = "pro required") {
      super(message);
      this.name = "CustomTemplateProRequiredError";
    }
  },
  InvalidAtaTemplateError: class InvalidAtaTemplateError extends Error {
    constructor(message = "invalid template") {
      super(message);
      this.name = "InvalidAtaTemplateError";
    }
  },
  MeetingTemplateNotFoundError: class MeetingTemplateNotFoundError extends Error {
    readonly status = 404;
    constructor(message = "not found") {
      super(message);
      this.name = "MeetingTemplateNotFoundError";
    }
  },
  requireOwnership: vi.fn(),
  requireExportPaidPlan: vi.fn(),
  requireCustomTemplateAccess: vi.fn(),
  renderAtaDocx: vi.fn(),
  buildAtaData: vi.fn(),
  buildAtaFilename: vi.fn(),
  resolveTemplateBuffer: vi.fn(),
  getOwnedMeetingWithRelationsForAuth: vi.fn(),
  buildAtaExportR2Key: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  uploadAudio: vi.fn(),
  withAuthRateLimit: vi.fn((_policy, handler) => {
    return (request: Request, context: { params: { id: string } }) =>
      handler(request, {
        ...context,
        auth: {
          user: { id: "user-1" },
          supabaseAdmin: { from: vi.fn() },
        },
      });
  }),
}));

vi.mock("@/lib/api/auth", () => ({
  requireOwnership: mocks.requireOwnership,
}));

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: mocks.withAuthRateLimit,
}));

vi.mock("@/lib/billing/ata-export-access", () => ({
  requireExportPaidPlan: mocks.requireExportPaidPlan,
  AtaExportPaidPlanRequiredError: mocks.AtaExportPaidPlanRequiredError,
}));

vi.mock("@/lib/billing/custom-template-access", () => ({
  requireCustomTemplateAccess: mocks.requireCustomTemplateAccess,
  CustomTemplateProRequiredError: mocks.CustomTemplateProRequiredError,
}));

vi.mock("@/lib/docx/generate-ata", () => ({
  renderAtaDocx: mocks.renderAtaDocx,
  InvalidAtaTemplateError: mocks.InvalidAtaTemplateError,
}));

vi.mock("@/lib/docx/meeting-ata-data", () => ({
  buildAtaData: mocks.buildAtaData,
  buildAtaFilename: mocks.buildAtaFilename,
}));

vi.mock("@/lib/meeting-templates", () => ({
  DEFAULT_TEMPLATE_ID: "default",
  MeetingTemplateNotFoundError: mocks.MeetingTemplateNotFoundError,
  resolveTemplateBuffer: mocks.resolveTemplateBuffer,
}));

vi.mock("@/lib/meetings/detail", () => ({
  getOwnedMeetingWithRelationsForAuth: mocks.getOwnedMeetingWithRelationsForAuth,
}));

vi.mock("@/lib/r2", () => ({
  buildAtaExportR2Key: mocks.buildAtaExportR2Key,
  getPresignedDownloadUrl: mocks.getPresignedDownloadUrl,
  uploadAudio: mocks.uploadAudio,
}));

function buildRequest(body?: unknown) {
  return new Request("http://localhost/api/meetings/meeting-1/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/meetings/[id]/export", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.requireOwnership.mockResolvedValue(undefined);
    mocks.requireExportPaidPlan.mockResolvedValue({ canExport: true, plan: "pro" });
    mocks.requireCustomTemplateAccess.mockResolvedValue({
      canUseCustomTemplates: true,
      plan: "team",
    });
    mocks.getOwnedMeetingWithRelationsForAuth.mockResolvedValue({
      id: "meeting-1",
      title: "Reunião",
    });
    mocks.buildAtaData.mockReturnValue({ meeting_title: "Reunião" });
    mocks.buildAtaFilename.mockReturnValue("ata-reuniao.docx");
    mocks.resolveTemplateBuffer.mockResolvedValue(Buffer.from("template"));
    mocks.renderAtaDocx.mockReturnValue(Buffer.from("docx"));
    mocks.buildAtaExportR2Key.mockReturnValue("ata-exports/user-1/meeting-1/123.docx");
    mocks.uploadAudio.mockResolvedValue(undefined);
    mocks.getPresignedDownloadUrl.mockResolvedValue("https://r2.example/ata.docx");
  });

  it("returns 403 when the meeting does not belong to the user", async () => {
    mocks.requireOwnership.mockRejectedValueOnce(
      Response.json({ error: "Acesso negado." }, { status: 403 })
    );

    const mod = await import("./route");
    const response = await mod.POST(buildRequest({}), { params: { id: "meeting-1" } });

    expect(response.status).toBe(403);
    expect(mocks.requireExportPaidPlan).not.toHaveBeenCalled();
  });

  it("returns 403 when the user does not have an active paid plan", async () => {
    mocks.requireExportPaidPlan.mockRejectedValueOnce(
      new mocks.AtaExportPaidPlanRequiredError("Faça upgrade.")
    );

    const mod = await import("./route");
    const response = await mod.POST(buildRequest({}), { params: { id: "meeting-1" } });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Faça upgrade." });
    expect(mocks.getOwnedMeetingWithRelationsForAuth).not.toHaveBeenCalled();
  });

  it("defaults to the default template when no templateId is sent", async () => {
    const mod = await import("./route");
    const response = await mod.POST(buildRequest(), { params: { id: "meeting-1" } });

    expect(response.status).toBe(200);
    expect(mocks.resolveTemplateBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "default"
    );
    expect(mocks.requireCustomTemplateAccess).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      url: "https://r2.example/ata.docx",
      filename: "ata-reuniao.docx",
      expiresIn: 3600,
    });
  });

  it("checks ownership and Pro access for a custom templateId", async () => {
    const mod = await import("./route");
    const response = await mod.POST(buildRequest({ templateId: "template-1" }), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(200);
    expect(mocks.requireOwnership).toHaveBeenCalledWith(
      expect.anything(),
      "meeting_templates",
      "template-1",
      "user-1"
    );
    expect(mocks.requireCustomTemplateAccess).toHaveBeenCalledWith(
      "user-1",
      expect.anything()
    );
  });

  it("returns 403 when a custom template is requested without the Pro plan", async () => {
    mocks.requireCustomTemplateAccess.mockRejectedValueOnce(
      new mocks.CustomTemplateProRequiredError("Somente Pro.")
    );

    const mod = await import("./route");
    const response = await mod.POST(buildRequest({ templateId: "template-1" }), {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Somente Pro." });
  });

  it("ignores unwhitelisted body fields and only reads templateId", async () => {
    const mod = await import("./route");
    await mod.POST(
      buildRequest({ templateId: "default", userId: "someone-else", status: "hacked" }),
      { params: { id: "meeting-1" } }
    );

    expect(mocks.resolveTemplateBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "default"
    );
  });

  it("returns 422 when the template fails to render", async () => {
    mocks.renderAtaDocx.mockImplementationOnce(() => {
      throw new mocks.InvalidAtaTemplateError("Template corrompido.");
    });

    const mod = await import("./route");
    const response = await mod.POST(buildRequest(), { params: { id: "meeting-1" } });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Template corrompido." });
  });
});
