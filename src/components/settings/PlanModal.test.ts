import { describe, expect, it } from "vitest";
import {
  CHECKOUT_SUPPORT_MODAL_TONE,
  createSettingsCheckoutPayload,
  getCheckoutSupportIssue,
  getPlanModalMode,
  isSettingsCheckoutDisabled,
} from "./PlanModal";
import { CheckoutSupportRequiredError } from "@/lib/checkout-client";

describe("PlanModal checkout payload", () => {
  it("marks dashboard plan changes as settings checkouts", () => {
    expect(createSettingsCheckoutPayload("pro", "yearly")).toEqual({
      plan: "pro",
      billingCycle: "yearly",
      price: 69,
      source: "settings",
    });
  });

  it("blocks paid checkout while billing customer prewarm is not ready", () => {
    expect(
      isSettingsCheckoutDisabled({
        currentPlan: "free",
        isLoading: false,
        planId: "starter",
        prewarmReady: false,
      })
    ).toBe(true);

    expect(
      isSettingsCheckoutDisabled({
        currentPlan: "free",
        isLoading: false,
        planId: "starter",
        prewarmReady: true,
      })
    ).toBe(false);
  });

  it("maps unapplied paid checkout errors to a support action", () => {
    const issue = getCheckoutSupportIssue(
      new CheckoutSupportRequiredError(
        "Recebemos o pagamento da sua assinatura, mas o plano ainda nao foi aplicado automaticamente.",
        "https://wa.me/5513996495858?text=Pagamento%20recebido"
      )
    );

    expect(issue).toEqual({
      message:
        "Recebemos o pagamento da sua assinatura, mas o plano ainda nao foi aplicado automaticamente.",
      whatsappUrl: "https://wa.me/5513996495858?text=Pagamento%20recebido",
    });
  });

  it("switches from plan selection to a separate error modal for unapplied payments", () => {
    expect(
      getPlanModalMode({
        supportIssue: {
          message: "Pagamento recebido sem ativacao.",
          whatsappUrl: "https://wa.me/5513996495858",
        },
      })
    ).toBe("support");
    expect(CHECKOUT_SUPPORT_MODAL_TONE.background).toContain("255,107,107");
    expect(CHECKOUT_SUPPORT_MODAL_TONE.actionBackground).toBe("#FF4D4F");
  });
});
