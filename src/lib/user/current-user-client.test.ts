import { beforeEach, describe, expect, it, vi } from "vitest";

describe("current user client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs out successfully when the API returns 204", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const mod = await import("./current-user-client");

    await expect(mod.logoutCurrentUser()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });

  it("throws the API error when logout fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 500,
      })
    );

    const mod = await import("./current-user-client");

    await expect(mod.logoutCurrentUser()).rejects.toThrow("Sessão inválida.");
  });
});
