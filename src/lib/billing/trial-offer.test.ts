import { describe, expect, it } from "vitest";
import { resolveTrialOfferEligibility, TRIAL_OFFER_REPROMPT_DAYS } from "./trial-offer";

const NOW = new Date("2026-07-27T12:00:00.000Z");

describe("resolveTrialOfferEligibility", () => {
  it("is eligible when the offer was never dismissed", () => {
    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: false,
        trialOfferDismissedAt: null,
        now: NOW,
      })
    ).toBe(true);
  });

  it("is not eligible when dismissed 3 days ago", () => {
    const dismissedAt = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: false,
        trialOfferDismissedAt: dismissedAt,
        now: NOW,
      })
    ).toBe(false);
  });

  it("is eligible again when dismissed 8 days ago", () => {
    const dismissedAt = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: false,
        trialOfferDismissedAt: dismissedAt,
        now: NOW,
      })
    ).toBe(true);
  });

  it("is never eligible once the trial was already used, regardless of dismiss state", () => {
    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: true,
        trialOfferDismissedAt: null,
        now: NOW,
      })
    ).toBe(false);

    const longDismissedAt = new Date(
      NOW.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: true,
        trialOfferDismissedAt: longDismissedAt,
        now: NOW,
      })
    ).toBe(false);
  });

  it("is never eligible when the user is not on the free plan", () => {
    expect(
      resolveTrialOfferEligibility({
        plan: "team",
        hasUsedTrial: false,
        trialOfferDismissedAt: null,
        now: NOW,
      })
    ).toBe(false);

    expect(
      resolveTrialOfferEligibility({
        plan: "pro",
        hasUsedTrial: false,
        trialOfferDismissedAt: null,
        now: NOW,
      })
    ).toBe(false);
  });

  it("exposes the reprompt window as a named constant", () => {
    expect(TRIAL_OFFER_REPROMPT_DAYS).toBe(7);
  });

  it("is not yet eligible when dismissed exactly TRIAL_OFFER_REPROMPT_DAYS days ago", () => {
    const dismissedAt = new Date(
      NOW.getTime() - TRIAL_OFFER_REPROMPT_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: false,
        trialOfferDismissedAt: dismissedAt,
        now: NOW,
      })
    ).toBe(false);
  });

  it("is eligible when dismissed just over TRIAL_OFFER_REPROMPT_DAYS days ago", () => {
    const dismissedAt = new Date(
      NOW.getTime() - TRIAL_OFFER_REPROMPT_DAYS * 24 * 60 * 60 * 1000 - 1
    ).toISOString();

    expect(
      resolveTrialOfferEligibility({
        plan: "free",
        hasUsedTrial: false,
        trialOfferDismissedAt: dismissedAt,
        now: NOW,
      })
    ).toBe(true);
  });
});
