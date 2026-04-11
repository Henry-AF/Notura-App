import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const getOrCreateBillingAccount = vi.fn();
const getBillingStatus = vi.fn();
const syncMeetingsThisMonth = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/billing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing")>("@/lib/billing");
  return {
    ...actual,
    getOrCreateBillingAccount,
    getBillingStatus,
    syncMeetingsThisMonth,
  };
});

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

function expectRateLimitedHeaders(response: Response) {
  expect(response.headers.get("x-ratelimit-limit")).toBeTruthy();
  expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
  expect(response.headers.get("x-ratelimit-reset")).toBeTruthy();
  expect(response.headers.get("retry-after")).toBeTruthy();
}

async function setupPatchedPolicies() {
  vi.doMock("@/lib/api/rate-limit-policies", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/api/rate-limit-policies")
    >("@/lib/api/rate-limit-policies");

    const patched = Object.fromEntries(
      Object.entries(actual.RATE_LIMIT_POLICIES).map(([key, value]) => [
        key,
        {
          ...value,
          limit: 2,
          windowMs: 60_000,
        },
      ])
    );

    return {
      RATE_LIMIT_POLICIES: patched,
    };
  });
}

describe("critical API routes rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "default-user" }));
    createServiceRoleClient.mockReturnValue({});
    getOrCreateBillingAccount.mockResolvedValue({
      plan: "free",
      abacatepay_pending_checkout_id: null,
      abacatepay_pending_plan: null,
    });
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "pro" },
      meetingsThisMonth: 0,
      monthlyLimit: 100,
    });
    syncMeetingsThisMonth.mockResolvedValue(undefined);

    delete process.env.ASSEMBLYAI_API_KEY;
    delete process.env.ASSEMBLYAI_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_rate_limit_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_rate_limit_123";
    process.env.ABACATEPAY_WEBHOOK_SECRET = "abacatepay-secret";
  });

  it("applies 429 contract to authenticated critical routes", async () => {
    const authenticatedCases = [
      {
        routePath: "./assemblyai/token/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/assemblyai/token?i=${idx}`, { method: "POST" }),
      },
      {
        routePath: "./meetings/process/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/meetings/process?i=${idx}`, {
            method: "POST",
            body: "{",
            headers: { "content-type": "application/json" },
          }),
      },
      {
        routePath: "./meetings/upload/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/meetings/upload?i=${idx}`, {
            method: "POST",
            body: "not-multipart",
            headers: { "content-type": "text/plain" },
          }),
      },
      {
        routePath: "./abacatepay/checkout/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/abacatepay/checkout?i=${idx}`, {
            method: "POST",
            body: JSON.stringify({ plan: "free" }),
            headers: { "content-type": "application/json" },
          }),
      },
      {
        routePath: "./abacatepay/checkout/verify/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/abacatepay/checkout/verify?i=${idx}`, {
            method: "POST",
          }),
      },
      {
        routePath: "./stripe/checkout/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/stripe/checkout?i=${idx}`, {
            method: "POST",
            body: JSON.stringify({ plan: "free" }),
            headers: { "content-type": "application/json" },
          }),
      },
      {
        routePath: "./stripe/checkout/verify/route",
        buildRequest: (idx: number) =>
          new Request(`http://localhost/api/stripe/checkout/verify?i=${idx}`, {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "content-type": "application/json" },
          }),
      },
    ] as const;

    for (let index = 0; index < authenticatedCases.length; index += 1) {
      const testCase = authenticatedCases[index];
      vi.resetModules();
      await setupPatchedPolicies();
      createServerSupabase.mockReturnValue(
        createServerClient({ id: `rate-limit-auth-user-${index}` })
      );

      const mod = (await import(testCase.routePath)) as {
        POST: (request: Request, context: { params: Record<string, string> }) => Promise<Response>;
      };

      let response = await mod.POST(testCase.buildRequest(1), {
        params: {},
      });
      response = await mod.POST(testCase.buildRequest(2), {
        params: {},
      });
      response = await mod.POST(testCase.buildRequest(3), {
        params: {},
      });

      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({
        error: "Muitas requisições. Tente novamente em instantes.",
        code: "rate_limited",
      });
      expectRateLimitedHeaders(response);
    }
  });

  it("applies 429 contract to public webhook routes", async () => {
    const webhookCases = [
      {
        routePath: "./webhooks/abacatepay/route",
        buildRequest: () =>
          new NextRequest(
            "http://localhost/api/webhooks/abacatepay?webhookSecret=wrong",
            {
              method: "POST",
              headers: {
                "x-forwarded-for": "203.0.113.10",
              },
              body: JSON.stringify({ event: "noop" }),
            }
          ),
      },
      {
        routePath: "./webhooks/assemblyai/route",
        buildRequest: () =>
          new NextRequest("http://localhost/api/webhooks/assemblyai", {
            method: "POST",
            headers: {
              "x-forwarded-for": "198.51.100.20",
            },
            body: JSON.stringify({}),
          }),
      },
      {
        routePath: "./webhooks/stripe/route",
        buildRequest: () =>
          new NextRequest("http://localhost/api/webhooks/stripe", {
            method: "POST",
            headers: {
              "x-forwarded-for": "192.0.2.30",
            },
            body: "{}",
          }),
      },
    ] as const;

    for (const testCase of webhookCases) {
      vi.resetModules();
      await setupPatchedPolicies();
      const mod = (await import(testCase.routePath)) as {
        POST: (request: Request, context?: unknown) => Promise<Response>;
      };

      let response = await mod.POST(testCase.buildRequest());
      response = await mod.POST(testCase.buildRequest());
      response = await mod.POST(testCase.buildRequest());

      expect(response.status).toBe(429);
      expect(await response.json()).toEqual({
        error: "Muitas requisições. Tente novamente em instantes.",
        code: "rate_limited",
      });
      expectRateLimitedHeaders(response);
    }
  });
});
