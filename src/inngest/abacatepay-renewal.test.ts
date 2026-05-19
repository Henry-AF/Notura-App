import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestStep {
  run: ReturnType<typeof vi.fn>;
}

interface TestInngestInput {
  event: { data: unknown };
  step: TestStep;
}

interface TestInngestFunction {
  handler: (input: TestInngestInput) => Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
  captureObservedError: vi.fn(),
  createFunction: vi.fn(
    (_config: unknown, handler: TestInngestFunction["handler"]) => ({ handler })
  ),
  createServiceRoleClient: vi.fn(),
  resetSubscriptionPeriod: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/billing", () => ({
  resetSubscriptionPeriod: mocks.resetSubscriptionPeriod,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

function createStep(): TestStep {
  return {
    run: vi.fn((_name: string, callback: () => Promise<unknown>) => callback()),
  };
}

describe("billing/abacatepay.renewal-confirmed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createServiceRoleClient.mockReturnValue({ from: vi.fn() });
    mocks.resetSubscriptionPeriod.mockResolvedValue(undefined);
  });

  it("resets from the previous period end carried by the renewal event", async () => {
    await import("./abacatepay-renewal");
    const step = createStep();
    const renewalFunction = mocks.createFunction.mock.results[0]
      ?.value as TestInngestFunction;

    await renewalFunction.handler({
      event: {
        data: {
          userId: "user-1",
          plan: "team",
          customerId: "customer-1",
          currentPeriodEnd: "2026-05-27T12:00:00.000Z",
        },
      },
      step,
    });

    expect(mocks.resetSubscriptionPeriod).toHaveBeenCalledWith(
      {
        userId: "user-1",
        plan: "team",
        clearAbacatePayPending: true,
        previousPeriodEnd: "2026-05-27T12:00:00.000Z",
        abacatepayCustomerId: "customer-1",
      },
      expect.any(Object)
    );
  });
});
