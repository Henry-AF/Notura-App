import { afterEach, describe, expect, it, vi } from "vitest";

describe("ai chats client api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a chat through the owned API route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./ai-chats-client-api");
    await mod.deleteAiChat("chat-1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/meeting-chats/chat-1", {
      method: "DELETE",
    });
  });

  it("throws a useful error when chat deletion fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Nao foi possivel excluir." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

    const mod = await import("./ai-chats-client-api");

    await expect(mod.deleteAiChat("chat-1")).rejects.toThrow(
      "Nao foi possivel excluir."
    );
  });
});
