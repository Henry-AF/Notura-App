import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const recordTrialOfferDismissed = vi.fn();
const withAuthRateLimit = vi.fn(
  (_policy: unknown, handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  }
);

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: (...args: Parameters<typeof withAuthRateLimit>) =>
    withAuthRateLimit(...args),
}));

vi.mock("@/lib/billing", () => ({
  recordTrialOfferDismissed,
}));

describe("PATCH /api/billing/trial/dismiss", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    recordTrialOfferDismissed.mockResolvedValue(undefined);
  });

  it("records the dismissal for the authenticated user", async () => {
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/billing/trial/dismiss", {
        method: "PATCH",
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dismissed: true });
    expect(recordTrialOfferDismissed).toHaveBeenCalledWith("user-1");
  });

  it("returns a 500 when recording the dismissal fails", async () => {
    recordTrialOfferDismissed.mockRejectedValueOnce(new Error("db down"));
    const mod = await import("./route");

    const response = await mod.PATCH(
      new Request("http://localhost/api/billing/trial/dismiss", {
        method: "PATCH",
      }) as never,
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(500);
  });

  it("is rate limited using the billingTrialDismiss policy", async () => {
    await import("./route");

    expect(withAuthRateLimit).toHaveBeenCalledWith(
      RATE_LIMIT_POLICIES.billingTrialDismiss,
      expect.any(Function)
    );
  });
});
