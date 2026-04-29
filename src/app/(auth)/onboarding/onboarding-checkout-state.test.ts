import { describe, expect, it } from "vitest";
import { isOnboardingCheckoutBlocked } from "./onboarding-checkout-state";

describe("onboarding checkout state", () => {
  it("blocks paid checkout while AbacatePay customer prewarm is not ready", () => {
    expect(
      isOnboardingCheckoutBlocked({
        loading: false,
        paymentVerifying: false,
        prewarmReady: false,
        selectedPlan: "pro",
      })
    ).toBe(true);

    expect(
      isOnboardingCheckoutBlocked({
        loading: false,
        paymentVerifying: false,
        prewarmReady: true,
        selectedPlan: "pro",
      })
    ).toBe(false);
  });

  it("does not block the free plan on AbacatePay prewarm", () => {
    expect(
      isOnboardingCheckoutBlocked({
        loading: false,
        paymentVerifying: false,
        prewarmReady: false,
        selectedPlan: "free",
      })
    ).toBe(false);
  });
});
