import { beforeEach, describe, expect, it, vi } from "vitest";

describe("contacts api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches registered integration interest channels", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channels: ["zoom", "chrome_extension"] }), {
        status: 200,
      })
    );

    const mod = await import("./contacts-api");
    const channels = await mod.fetchIntegrationInterest();

    expect(fetchMock).toHaveBeenCalledWith("/api/integration-interest", {
      method: "GET",
    });
    expect(channels).toEqual(["zoom", "chrome_extension"]);
  });

  it("registers integration interest for a channel", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channel: "zoom" }), { status: 200 })
    );

    const mod = await import("./contacts-api");
    await mod.registerIntegrationInterest("zoom");

    expect(fetchMock).toHaveBeenCalledWith("/api/integration-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "zoom" }),
    });
  });

  it("throws with the API error message when registering fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
      })
    );

    const mod = await import("./contacts-api");
    await expect(mod.registerIntegrationInterest("zoom")).rejects.toThrow(
      "Não autenticado."
    );
  });
});
