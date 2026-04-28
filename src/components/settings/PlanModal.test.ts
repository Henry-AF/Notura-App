import { describe, expect, it } from "vitest";
import { createSettingsCheckoutPayload } from "./PlanModal";

describe("PlanModal checkout payload", () => {
  it("marks dashboard plan changes as settings checkouts", () => {
    expect(createSettingsCheckoutPayload("team")).toEqual({
      plan: "team",
      source: "settings",
    });
  });
});
