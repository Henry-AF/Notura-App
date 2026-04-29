import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;

const createServiceRoleClient = vi.fn();
const ensureAbacatePayCustomer = vi.fn();
const isAbacatePayTimeoutError = vi.fn();
const loadAbacatePayCustomerContext = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return async (
      request: Request,
      context: { params: Record<string, string> }
    ) => {
      return handler(request, { ...context, auth: authContext });
    };
  },
}));

vi.mock("@/lib/abacatepay", () => ({
  isAbacatePayTimeoutError,
}));

vi.mock("@/lib/abacatepay-customer", () => ({
  AbacatePayCustomerNotReadyError: class AbacatePayCustomerNotReadyError extends Error {
    constructor() {
      super("Estamos preparando seu checkout. Tente novamente em alguns segundos.");
    }
  },
  ensureAbacatePayCustomer,
  loadAbacatePayCustomerContext,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

describe("POST /api/abacatepay/customer/ensure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServiceRoleClient.mockReturnValue({ db: true });
    isAbacatePayTimeoutError.mockReturnValue(false);
    loadAbacatePayCustomerContext.mockResolvedValue({
      billingAccount: {
        abacatepay_customer_id: "customer-1",
      },
      profile: null,
    });
    ensureAbacatePayCustomer.mockResolvedValue({
      status: "ready",
      customerId: "customer-1",
    });
  });

  it("passes the prewarm source into the idempotent customer preparation", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/abacatepay/customer/ensure", {
        method: "POST",
        body: JSON.stringify({ source: "settings" }),
      }),
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(ensureAbacatePayCustomer).toHaveBeenCalledWith(
      { db: true },
      {
        id: "user-1",
        email: "ana@example.com",
      },
      expect.objectContaining({
        billingAccount: expect.objectContaining({
          abacatepay_customer_id: "customer-1",
        }),
      }),
      {
        source: "settings",
      }
    );
  });
});
