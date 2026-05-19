import { beforeEach, describe, expect, it, vi } from "vitest";

describe("billing auto-renew client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates auto-renew through the billing gateway endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "stripe",
          autoRenewEnabled: false,
          currentPeriodEnd: "2026-05-27T12:00:00.000Z",
          renewalStatus: "canceling",
        }),
        { status: 200 }
      )
    );

    const mod = await import("./billing-auto-renew-client");
    const result = await mod.updateBillingAutoRenew(false);

    expect(result).toEqual({
      provider: "stripe",
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-05-27T12:00:00.000Z",
      renewalStatus: "canceling",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/auto-renew", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
  });
});
