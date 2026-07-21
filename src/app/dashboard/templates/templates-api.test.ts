import { afterEach, describe, expect, it, vi } from "vitest";

describe("mapTemplatesResponse", () => {
  it("maps raw template summaries into TemplateOption shape", async () => {
    const { mapTemplatesResponse } = await import("./templates-api");

    const result = mapTemplatesResponse([
      { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
      {
        id: "template-1",
        name: "Meu modelo",
        isDefault: false,
        editable: true,
        createdAt: "2026-07-13T00:00:00.000Z",
      },
    ]);

    expect(result).toEqual([
      { id: "default", name: "Modelo padrão", isDefault: true, editable: false, createdAt: undefined },
      {
        id: "template-1",
        name: "Meu modelo",
        isDefault: false,
        editable: true,
        createdAt: "2026-07-13T00:00:00.000Z",
      },
    ]);
  });
});

describe("mapUploadedTemplate", () => {
  it("maps a raw persisted template row into TemplateOption shape", async () => {
    const { mapUploadedTemplate } = await import("./templates-api");

    const result = mapUploadedTemplate({
      id: "template-1",
      name: "Meu modelo",
      created_at: "2026-07-13T00:00:00.000Z",
    });

    expect(result).toEqual({
      id: "template-1",
      name: "Meu modelo",
      isDefault: false,
      editable: true,
      createdAt: "2026-07-13T00:00:00.000Z",
    });
  });
});

describe("fetchTemplates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the mapped templates on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          templates: [
            { id: "default", name: "Modelo padrão", isDefault: true, editable: false },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { fetchTemplates } = await import("./templates-api");
    const result = await fetchTemplates();

    expect(result).toEqual([
      { id: "default", name: "Modelo padrão", isDefault: true, editable: false, createdAt: undefined },
    ]);
  });

  it("throws with the API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Erro ao listar." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const { fetchTemplates } = await import("./templates-api");

    await expect(fetchTemplates()).rejects.toThrow("Erro ao listar.");
  });
});

describe("uploadTemplate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildFile() {
    return new File([new Uint8Array([0x50, 0x4b])], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  it("uploads the file and returns the mapped template on success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          template: {
            id: "template-1",
            name: "Meu modelo",
            created_at: "2026-07-13T00:00:00.000Z",
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      )
    );

    const { uploadTemplate } = await import("./templates-api");
    const result = await uploadTemplate(buildFile(), "Meu modelo");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/meeting-templates",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
    expect(result).toEqual({
      id: "template-1",
      name: "Meu modelo",
      isDefault: false,
      editable: true,
      createdAt: "2026-07-13T00:00:00.000Z",
    });
  });

  it("throws TemplatePlanRequiredError on a 403 response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ error: "Somente Pro." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    const { uploadTemplate, TemplatePlanRequiredError } = await import("./templates-api");

    try {
      await uploadTemplate(buildFile(), "Meu modelo");
      expect.fail("expected uploadTemplate to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TemplatePlanRequiredError);
      expect((error as Error).message).toBe("Somente Pro.");
    }
  });

  it("throws InvalidTemplatePlaceholdersError with the unknown placeholders on a 422 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "O modelo contém placeholders desconhecidos.",
          unknownPlaceholders: ["budget_forecast"],
        }),
        { status: 422, headers: { "content-type": "application/json" } }
      )
    );

    const { uploadTemplate, InvalidTemplatePlaceholdersError } = await import(
      "./templates-api"
    );

    try {
      await uploadTemplate(buildFile(), "Meu modelo");
      expect.fail("expected uploadTemplate to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTemplatePlaceholdersError);
      expect((error as InstanceType<typeof InvalidTemplatePlaceholdersError>).unknownPlaceholders).toEqual([
        "budget_forecast",
      ]);
    }
  });

  it("throws a generic error on other failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Arquivo muito grande." }), {
        status: 413,
        headers: { "content-type": "application/json" },
      })
    );

    const { uploadTemplate } = await import("./templates-api");

    await expect(uploadTemplate(buildFile(), "Meu modelo")).rejects.toThrow(
      "Arquivo muito grande."
    );
  });
});

describe("deleteTemplate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves without error on a 204 response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const { deleteTemplate } = await import("./templates-api");
    await deleteTemplate("template-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meeting-templates/template-1", {
      method: "DELETE",
    });
  });

  it("throws TemplatePlanRequiredError on a 403 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    const { deleteTemplate, TemplatePlanRequiredError } = await import("./templates-api");

    await expect(deleteTemplate("template-1")).rejects.toThrow(TemplatePlanRequiredError);
  });

  it("throws a generic error on other failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Erro ao remover modelo de ata." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const { deleteTemplate } = await import("./templates-api");

    await expect(deleteTemplate("template-1")).rejects.toThrow(
      "Erro ao remover modelo de ata."
    );
  });
});
