import { beforeEach, describe, expect, it, vi } from "vitest";

describe("abacatepay customer client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ready only when the idempotent ensure endpoint confirms success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, customerId: "customer-1" }), {
        status: 200,
      })
    );

    const mod = await import("./abacatepay-customer-client");
    const result = await mod.prewarmAbacatePayCustomer("settings");

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/abacatepay/customer/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "settings" }),
    });
  });

  it("does not treat in-progress prewarm responses as ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, inProgress: true }), {
        status: 202,
      })
    );

    const mod = await import("./abacatepay-customer-client");
    const result = await mod.prewarmAbacatePayCustomer("onboarding");

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/abacatepay/customer/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "onboarding" }),
    });
  });
});
