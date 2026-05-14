import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const ensureBillingCustomer = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/billing-gateway", () => ({
  ensureBillingCustomer,
}));

describe("POST /api/billing/customer/ensure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    ensureBillingCustomer.mockResolvedValue({
      provider: "stripe",
      status: "ready",
      customerId: "cus_123",
    });
  });

  it("prewarms the primary billing customer through the gateway", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/customer/ensure", {
        method: "POST",
        body: JSON.stringify({ source: "onboarding" }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      provider: "stripe",
      customerId: "cus_123",
    });
    expect(ensureBillingCustomer).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "ana@example.com",
      source: "onboarding",
    });
  });

  it("keeps in-progress fallback prewarm as accepted", async () => {
    ensureBillingCustomer.mockResolvedValueOnce({
      provider: "abacatepay",
      status: "in_progress",
    });
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/billing/customer/ensure", {
        method: "POST",
      }),
      { params: {} }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      success: false,
      provider: "abacatepay",
      inProgress: true,
    });
  });
});
