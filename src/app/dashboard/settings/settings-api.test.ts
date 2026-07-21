import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settings api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the current user through /api/user/me", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            email: "ana@example.com",
            name: "Ana",
            company: "Acme",
            whatsappNumber: "+55 (11) 99999-9999",
            plan: "pro",
            meetingsThisMonth: 12,
            monthlyLimit: 30,
          },
        }),
        { status: 200 }
      )
    );

    const mod = await import("./settings-api");
    const user = await mod.fetchCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith("/api/user/me", { method: "GET" });
    expect(user).toEqual({
      id: "user-1",
      email: "ana@example.com",
      name: "Ana",
      company: "Acme",
      whatsappNumber: "+55 (11) 99999-9999",
      plan: "pro",
      meetingsThisMonth: 12,
      monthlyLimit: 30,
    });
  });

  it("updates the current user through /api/user/me", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            email: "ana@example.com",
            name: "Ana Clara",
            company: "Acme",
            whatsappNumber: "+55 (11) 99999-9999",
            plan: "pro",
            meetingsThisMonth: 12,
            monthlyLimit: 30,
          },
        }),
        { status: 200 }
      )
    );

    const mod = await import("./settings-api");
    const user = await mod.updateCurrentUser({
      name: "Ana Clara",
      company: "Acme",
      whatsappNumber: "+55 (11) 99999-9999",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ana Clara",
        company: "Acme",
        whatsappNumber: "+55 (11) 99999-9999",
      }),
    });
    expect(user.name).toBe("Ana Clara");
  });

  it("verifies a settings checkout through the billing gateway endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, plan: "team" }), {
        status: 200,
      })
    );

    const mod = await import("./settings-api");
    await mod.verifySettingsPayment("cs_test_123");

    expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "cs_test_123" }),
    });
  });

  it("updates billing auto-renew through the settings helper", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "stripe",
          autoRenewEnabled: false,
          currentPeriodEnd: "2026-05-27T12:00:00.000Z",
          renewalStatus: "active",
        }),
        { status: 200 }
      )
    );

    const mod = await import("./settings-api");
    const result = await mod.updateBillingAutoRenew(false);

    expect(result).toEqual({
      provider: "stripe",
      autoRenewEnabled: false,
      currentPeriodEnd: "2026-05-27T12:00:00.000Z",
      renewalStatus: "active",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/auto-renew", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
  });

  it("prewarms the billing customer through the settings api helper", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, customerId: "customer-1" }), {
        status: 200,
      })
    );

    const mod = await import("./settings-api");
    const result = await mod.prewarmBillingCustomer();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/customer/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "settings" }),
    });
  });

  it("fetches registered integration interest channels", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channels: ["zoom"] }), { status: 200 })
    );

    const mod = await import("./settings-api");
    const channels = await mod.fetchIntegrationInterest();

    expect(fetchMock).toHaveBeenCalledWith("/api/integration-interest", {
      method: "GET",
    });
    expect(channels).toEqual(["zoom"]);
  });

  it("registers integration interest for a channel", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ channel: "chrome_extension" }), {
        status: 200,
      })
    );

    const mod = await import("./settings-api");
    await mod.registerIntegrationInterest("chrome_extension");

    expect(fetchMock).toHaveBeenCalledWith("/api/integration-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "chrome_extension" }),
    });
  });
});
