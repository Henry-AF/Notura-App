import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureAbacatepayCustomer,
  startOnboardingCheckout,
  verifyOnboardingPayment,
} from "./onboarding-api";

describe("onboarding api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("treats accepted customer prewarm responses as ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 202 })
    );

    const result = await ensureAbacatepayCustomer();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/abacatepay/customer/ensure", {
      method: "POST",
    });
  });

  it("returns the checkout redirect url for paid plans", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          checkoutUrl: "https://checkout.example.com/session",
        }),
        { status: 200 }
      )
    );

    const result = await startOnboardingCheckout("pro");

    expect(result).toEqual({
      checkoutUrl: "https://checkout.example.com/session",
      alreadyActive: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/abacatepay/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan: "pro" }),
    });
  });

  it("keeps the user in the flow when the paid plan is already active", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ alreadyActive: true }), { status: 200 })
    );

    await expect(startOnboardingCheckout("team")).resolves.toEqual({
      checkoutUrl: null,
      alreadyActive: true,
    });
  });

  it("throws when checkout succeeds without a redirect url", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );

    await expect(startOnboardingCheckout("pro")).rejects.toThrow(
      "Checkout não retornou URL de redirecionamento."
    );
  });

  it("throws the API error when payment verification fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Pagamento pendente." }), {
        status: 409,
      })
    );

    await expect(verifyOnboardingPayment()).rejects.toThrow(
      "Pagamento pendente."
    );
  });
});
