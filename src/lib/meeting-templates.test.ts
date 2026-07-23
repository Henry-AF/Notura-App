import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnership: vi.fn(),
  getCustomTemplateAccess: vi.fn(),
  deleteAudio: vi.fn(),
  downloadAudio: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireOwnership: mocks.requireOwnership,
}));

vi.mock("@/lib/billing/custom-template-access", () => ({
  getCustomTemplateAccess: mocks.getCustomTemplateAccess,
}));

vi.mock("@/lib/r2", () => ({
  deleteAudio: mocks.deleteAudio,
  downloadAudio: mocks.downloadAudio,
}));

function createSupabaseStub(overrides: Record<string, unknown> = {}) {
  return { from: vi.fn(), ...overrides } as never;
}

describe("meeting-templates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireOwnership.mockResolvedValue(undefined);
  });

  describe("listTemplatesForUser", () => {
    it("returns only the default template for users without custom template access", async () => {
      mocks.getCustomTemplateAccess.mockResolvedValue({
        canUseCustomTemplates: false,
        plan: "pro",
      });

      const mod = await import("./meeting-templates");
      const templates = await mod.listTemplatesForUser(createSupabaseStub(), "user-1");

      expect(templates).toEqual([
        { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
      ]);
    });

    it("prepends the default template to the user's custom templates on the team plan", async () => {
      mocks.getCustomTemplateAccess.mockResolvedValue({
        canUseCustomTemplates: true,
        plan: "team",
      });

      const order = vi.fn().mockResolvedValue({
        data: [{ id: "template-1", name: "Meu modelo", created_at: "2026-07-01T00:00:00.000Z" }],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      const supabase = createSupabaseStub({ from: vi.fn().mockReturnValue({ select }) });

      const mod = await import("./meeting-templates");
      const templates = await mod.listTemplatesForUser(supabase, "user-1");

      expect(templates).toEqual([
        { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
        {
          id: "template-1",
          name: "Meu modelo",
          isDefault: false,
          editable: true,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ]);
    });
  });

  describe("createTemplate", () => {
    it("rejects an empty name without touching the database", async () => {
      mocks.getCustomTemplateAccess.mockResolvedValue({
        canUseCustomTemplates: true,
        plan: "team",
      });
      const from = vi.fn();
      const mod = await import("./meeting-templates");

      await expect(
        mod.createTemplate(createSupabaseStub({ from }), "user-1", {
          name: "   ",
          r2Key: "templates/user-1/1/file.docx",
          originalFilename: "file.docx",
          placeholders: [],
        })
      ).rejects.toThrow(mod.MeetingTemplateValidationError);
      expect(from).not.toHaveBeenCalled();
    });

    it("inserts a whitelisted row and returns it", async () => {
      const single = vi.fn().mockResolvedValue({
        data: {
          id: "template-1",
          user_id: "user-1",
          name: "Meu modelo",
          r2_key: "templates/user-1/1/file.docx",
          original_filename: "file.docx",
          placeholders: ["meeting_title"],
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      const from = vi.fn().mockReturnValue({ insert });

      const mod = await import("./meeting-templates");
      const result = await mod.createTemplate(createSupabaseStub({ from }), "user-1", {
        name: "Meu modelo",
        r2Key: "templates/user-1/1/file.docx",
        originalFilename: "file.docx",
        placeholders: ["meeting_title"],
      });

      expect(insert).toHaveBeenCalledWith({
        user_id: "user-1",
        name: "Meu modelo",
        r2_key: "templates/user-1/1/file.docx",
        original_filename: "file.docx",
        placeholders: ["meeting_title"],
      });
      expect(result.id).toBe("template-1");
    });
  });

  describe("deleteTemplate", () => {
    it("requires ownership, removes the R2 object and deletes the row", async () => {
      const single = vi
        .fn()
        .mockResolvedValue({ data: { r2_key: "templates/user-1/1/file.docx" }, error: null });
      const eqForSelect = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq: eqForSelect });
      const eqForDelete = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq: eqForDelete });
      const from = vi.fn().mockReturnValue({ select, delete: del });

      const mod = await import("./meeting-templates");
      await mod.deleteTemplate(createSupabaseStub({ from }), "user-1", "template-1");

      expect(mocks.requireOwnership).toHaveBeenCalledWith(
        expect.anything(),
        "meeting_templates",
        "template-1",
        "user-1"
      );
      expect(mocks.deleteAudio).toHaveBeenCalledWith("templates/user-1/1/file.docx");
      expect(del).toHaveBeenCalled();
    });
  });

  describe("resolveTemplateBuffer", () => {
    it("reads the bundled default template for the default id", async () => {
      const mod = await import("./meeting-templates");
      const buffer = await mod.resolveTemplateBuffer(
        createSupabaseStub(),
        "user-1",
        mod.DEFAULT_TEMPLATE_ID
      );

      expect(buffer.subarray(0, 2).toString()).toBe("PK");
      expect(mocks.requireOwnership).not.toHaveBeenCalled();
    });

    it("requires ownership and downloads the buffer from R2 for a custom template", async () => {
      const single = vi
        .fn()
        .mockResolvedValue({ data: { r2_key: "templates/user-1/1/file.docx" }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ select });
      mocks.downloadAudio.mockResolvedValue(Buffer.from("PK\x03\x04"));

      const mod = await import("./meeting-templates");
      const buffer = await mod.resolveTemplateBuffer(
        createSupabaseStub({ from }),
        "user-1",
        "template-1"
      );

      expect(mocks.requireOwnership).toHaveBeenCalledWith(
        expect.anything(),
        "meeting_templates",
        "template-1",
        "user-1"
      );
      expect(mocks.downloadAudio).toHaveBeenCalledWith("templates/user-1/1/file.docx");
      expect(buffer.toString()).toBe("PK\x03\x04");
    });
  });
});
