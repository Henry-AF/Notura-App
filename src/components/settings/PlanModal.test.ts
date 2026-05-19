import { describe, expect, it } from "vitest";
import {
  createSettingsCheckoutRequest,
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

  it("sends dashboard plan changes to the billing gateway endpoint", () => {
    expect(createSettingsCheckoutRequest("pro")).toEqual({
      url: "/api/billing/checkout",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", source: "settings" }),
      },
    });
  });

  it("blocks paid checkout while billing customer prewarm is not ready", () => {
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
