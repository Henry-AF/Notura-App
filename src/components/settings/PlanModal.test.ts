import { describe, expect, it } from "vitest";
import {
  createSettingsCheckoutPayload,
  isSettingsCheckoutDisabled,
} from "./PlanModal";

describe("PlanModal checkout payload", () => {
  it("marks dashboard plan changes as settings checkouts", () => {
    expect(createSettingsCheckoutPayload("team")).toEqual({
      plan: "team",
      source: "settings",
    });
  });

  it("blocks paid checkout while AbacatePay customer prewarm is not ready", () => {
    expect(
      isSettingsCheckoutDisabled({
        currentPlan: "free",
        isLoading: false,
        planId: "pro",
        prewarmReady: false,
      })
    ).toBe(true);

    expect(
      isSettingsCheckoutDisabled({
        currentPlan: "free",
        isLoading: false,
        planId: "pro",
        prewarmReady: true,
      })
    ).toBe(false);
  });
});
