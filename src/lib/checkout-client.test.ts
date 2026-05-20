import { beforeEach, describe, expect, it, vi } from "vitest";

describe("checkout client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws an actionable support error when a paid checkout was not applied", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error:
            "Recebemos o pagamento da sua assinatura, mas o plano ainda nao foi aplicado automaticamente.",
          errorCode: "payment_received_plan_pending",
          supportWhatsappUrl:
            "https://wa.me/5513996495858?text=Pagamento%20recebido",
        }),
        { status: 409 }
      )
    );
    const { CheckoutSupportRequiredError, startPlanCheckout } = await import(
      "./checkout-client"
    );

    const result = startPlanCheckout({
      plan: "starter",
      billingCycle: "monthly",
      price: 49,
      source: "settings",
    });

    await expect(result).rejects.toMatchObject({
      name: "CheckoutSupportRequiredError",
      whatsappUrl: "https://wa.me/5513996495858?text=Pagamento%20recebido",
    });
    await result.catch((error) => {
      expect(error).toBeInstanceOf(CheckoutSupportRequiredError);
    });
  });
});
