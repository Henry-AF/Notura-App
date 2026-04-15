import { describe, expect, it } from "vitest";
import {
  getAbacatePayCheckoutExternalId,
  isAbacatePaySubscriptionPaid,
  parseAbacatePayOnboardingExternalId,
} from "./abacatepay";

describe("abacatepay payment status", () => {
  it("treats PAID as paid", () => {
    expect(
      isAbacatePaySubscriptionPaid({
        id: "sub-1",
        status: "PAID",
      })
    ).toBe(true);
  });

  it("treats ACTIVE subscription as paid for onboarding verification", () => {
    expect(
      isAbacatePaySubscriptionPaid({
        id: "sub-1",
        status: "ACTIVE",
      })
    ).toBe(true);
  });

  it("does not treat pending as paid", () => {
    expect(
      isAbacatePaySubscriptionPaid({
        id: "sub-1",
        status: "PENDING",
      })
    ).toBe(false);
  });
});

describe("abacatepay external id helpers", () => {
  it("builds a checkout external id with a unique suffix", () => {
    const externalId = getAbacatePayCheckoutExternalId("user-1", "pro", "nonce-1");

    expect(externalId).toBe("onboarding:user-1:pro:nonce-1");
  });

  it("parses onboarding external id with provider suffix", () => {
    expect(
      parseAbacatePayOnboardingExternalId("onboarding:user-1:pro:nonce-1")
    ).toEqual({
      userId: "user-1",
      plan: "pro",
    });
  });

  it("returns null for malformed external id", () => {
    expect(parseAbacatePayOnboardingExternalId("invalid:value")).toBeNull();
  });
});
