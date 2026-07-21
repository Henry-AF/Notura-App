import { beforeEach, describe, expect, it, vi } from "vitest";

describe("integration interest client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerIntegrationInterest", () => {
    it("posts the channel and resolves on success", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ channel: "zoom" }), { status: 200 })
      );

      const mod = await import("./integration-interest-client");
      await expect(mod.registerIntegrationInterest("zoom")).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledWith("/api/integration-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "zoom" }),
      });
    });

    it("throws with the API error message on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Canal inválido." }), {
          status: 400,
        })
      );

      const mod = await import("./integration-interest-client");
      await expect(
        mod.registerIntegrationInterest("chrome_extension")
      ).rejects.toThrow("Canal inválido.");
    });

    it("throws a fallback message when the API returns no error body", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 500 })
      );

      const mod = await import("./integration-interest-client");
      await expect(mod.registerIntegrationInterest("zoom")).rejects.toThrow(
        "Erro ao registrar interesse na integração."
      );
    });
  });

  describe("fetchIntegrationInterest", () => {
    it("returns the registered channels on success", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ channels: ["zoom"] }), { status: 200 })
      );

      const mod = await import("./integration-interest-client");
      const channels = await mod.fetchIntegrationInterest();

      expect(fetchMock).toHaveBeenCalledWith("/api/integration-interest", {
        method: "GET",
      });
      expect(channels).toEqual(["zoom"]);
    });

    it("throws with the API error message on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Não autenticado." }), {
          status: 401,
        })
      );

      const mod = await import("./integration-interest-client");
      await expect(mod.fetchIntegrationInterest()).rejects.toThrow(
        "Não autenticado."
      );
    });

    it("throws a fallback message when the response has no channels", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const mod = await import("./integration-interest-client");
      await expect(mod.fetchIntegrationInterest()).rejects.toThrow(
        "Erro ao buscar interesse em integrações."
      );
    });
  });
});
