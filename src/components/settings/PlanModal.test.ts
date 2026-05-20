import { describe, expect, it } from "vitest";
import {
  createSettingsCheckoutPayload,
  isSettingsCheckoutDisabled,
} from "./PlanModal";

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
});
