import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissTrialOffer,
  startTrialCheckout,
  verifyTrialCheckout,
} from "./trial-offer-client";

// vitest runs in a "node" environment (no DOM) for this file, so `window`
// does not exist as a global — stub just enough of it for the redirect.
function mockWindowLocation() {
  (globalThis as { window?: unknown }).window = { location: { href: "" } };
}

describe("startTrialCheckout", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    mockWindowLocation();
  });

  it("redirects to the returned checkout URL on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ checkoutUrl: "https://checkout.stripe.com/trial" }),
        { status: 200 }
      )
    );

    await startTrialCheckout();

    expect(fetch).toHaveBeenCalledWith("/api/billing/trial/checkout", {
      method: "POST",
    });
    expect(window.location.href).toBe("https://checkout.stripe.com/trial");
  });

  it("throws with the API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Você já usou seu período de teste gratuito." }),
        { status: 409 }
      )
    );

    await expect(startTrialCheckout()).rejects.toThrow(
      "Você já usou seu período de teste gratuito."
    );
  });

  it("throws when the response is missing a checkout URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );

    await expect(startTrialCheckout()).rejects.toThrow(
      "Checkout do trial não retornou URL de redirecionamento."
    );
  });
});

describe("dismissTrialOffer", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("PATCHes the dismiss endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ dismissed: true }), { status: 200 })
    );

    await dismissTrialOffer();

    expect(fetch).toHaveBeenCalledWith("/api/billing/trial/dismiss", {
      method: "PATCH",
    });
  });

  it("throws with the API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Falha ao dispensar." }), {
        status: 500,
      })
    );

    await expect(dismissTrialOffer()).rejects.toThrow("Falha ao dispensar.");
  });
});

describe("verifyTrialCheckout", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("POSTs the session id to the verify endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    await verifyTrialCheckout("cs_123");

    expect(fetch).toHaveBeenCalledWith("/api/billing/trial/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "cs_123" }),
    });
  });

  it("throws with the API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Sessão de checkout do trial não informada." }),
        { status: 400 }
      )
    );

    await expect(verifyTrialCheckout("cs_123")).rejects.toThrow(
      "Sessão de checkout do trial não informada."
    );
  });
});
