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

  it("verifies an AbacatePay settings checkout through the checkout verify endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, plan: "team" }), {
        status: 200,
      })
    );

    const mod = await import("./settings-api");
    await mod.verifySettingsPayment();

    expect(fetchMock).toHaveBeenCalledWith("/api/abacatepay/checkout/verify", {
      method: "POST",
    });
  });

  it("prewarms the AbacatePay customer through the settings api helper", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, customerId: "customer-1" }), {
        status: 200,
      })
    );

    const mod = await import("./settings-api");
    const result = await mod.prewarmAbacatePayCustomer();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/abacatepay/customer/ensure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "settings" }),
    });
  });
});
