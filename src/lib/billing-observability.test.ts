import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryStartSpan = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  startSpan: sentryStartSpan,
}));

describe("billing observability helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("starts AbacatePay billing spans with normalized attributes", async () => {
    const setAttribute = vi.fn();
    sentryStartSpan.mockImplementation((_options, callback) => {
      return callback({ setAttribute });
    });

    const mod = await import("./billing-observability");
    const result = await mod.withBillingSpan(
      {
        name: "billing.abacatepay.load_customer_context",
        op: "db",
        attributes: {
          "billing.flow": "settings",
          hadCustomerIdAtStart: true,
          waitedForFreshLock: false,
          ignored: undefined,
        },
      },
      async (span) => {
        mod.setBillingSpanAttribute(span, "waitedForFreshLock", true);
        return "ok";
      }
    );

    expect(result).toBe("ok");
    expect(setAttribute).toHaveBeenCalledWith("waitedForFreshLock", true);
    expect(sentryStartSpan).toHaveBeenCalledWith(
      {
        name: "billing.abacatepay.load_customer_context",
        op: "db",
        attributes: {
          "billing.provider": "abacatepay",
          "billing.flow": "settings",
          hadCustomerIdAtStart: true,
          waitedForFreshLock: false,
        },
      },
      expect.any(Function)
    );
  });
});
