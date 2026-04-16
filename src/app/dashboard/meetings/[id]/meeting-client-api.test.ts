import { afterEach, describe, expect, it, vi } from "vitest";

describe("meeting detail client api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a meeting through the owned API route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./meeting-client-api");
    await mod.deleteMeetingById("meeting-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meetings/meeting-1", {
      method: "DELETE",
    });
  });

  it("throws a useful error when the meeting deletion fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Nao foi possivel excluir." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./meeting-client-api");

    await expect(mod.deleteMeetingById("meeting-1")).rejects.toThrow(
      "Nao foi possivel excluir."
    );
  });
});
