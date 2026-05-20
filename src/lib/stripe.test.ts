import { describe, expect, it } from "vitest";

describe("Stripe subscription billing period", () => {
  it("uses the Stripe subscription period and price interval as source of truth", async () => {
    const { getStripeSubscriptionBillingPeriod } = await import("./stripe");

    expect(
      getStripeSubscriptionBillingPeriod({
        current_period_start: 1_777_291_200,
        current_period_end: 1_808_827_200,
        items: {
          data: [
            {
              current_period_start: 1_777_291_200,
              current_period_end: 1_808_827_200,
              price: {
                recurring: {
                  interval: "year",
                },
              },
            },
          ],
        },
      } as never)
    ).toEqual({
      billingCycle: "yearly",
      currentPeriodStart: "2026-04-27T12:00:00.000Z",
      currentPeriodEnd: "2027-04-27T12:00:00.000Z",
    });
  });

  it("does not depend on removed root-level Stripe subscription period fields", async () => {
    const { getStripeSubscriptionBillingPeriod } = await import("./stripe");

    expect(
      getStripeSubscriptionBillingPeriod({
        items: {
          data: [
            {
              current_period_start: 1_777_291_200,
              current_period_end: 1_808_827_200,
              price: {
                recurring: {
                  interval: "month",
                },
              },
            },
          ],
        },
      } as never)
    ).toEqual({
      billingCycle: "monthly",
      currentPeriodStart: "2026-04-27T12:00:00.000Z",
      currentPeriodEnd: "2027-04-27T12:00:00.000Z",
    });
  });
});
