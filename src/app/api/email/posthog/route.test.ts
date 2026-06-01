import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendWelcomeEmailOnce = vi.fn();
const sendInactivityEmailOnce = vi.fn();
const getBillingStatus = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/api/rate-limit-route", () => ({
  withPublicRateLimit: (_policy: unknown, handler: (request: Request) => Promise<Response>) =>
    handler,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/email/delivery", () => ({
  sendInactivityEmailOnce,
  sendWelcomeEmailOnce,
}));

vi.mock("@/lib/billing", () => ({
  getBillingStatus,
}));

function createAdminClient() {
  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "ana@example.com",
              user_metadata: { full_name: "Ana" },
            },
          },
          error: null,
        }),
      },
    },
  };
}

describe("POST /api/email/posthog", () => {
  const originalSecret = process.env.POSTHOG_EMAIL_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.POSTHOG_EMAIL_WEBHOOK_SECRET = "secret";
    createServiceRoleClient.mockReturnValue(createAdminClient());
    sendWelcomeEmailOnce.mockResolvedValue({ status: "sent" });
    sendInactivityEmailOnce.mockResolvedValue({ status: "sent" });
    getBillingStatus.mockResolvedValue({
      meetingsUsed: 3,
      quotaStatus: { quotaLimit: 3 },
    });
  });

  afterEach(() => {
    process.env.POSTHOG_EMAIL_WEBHOOK_SECRET = originalSecret;
  });

  it("rejects requests without the webhook secret", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/email/posthog", {
        method: "POST",
        body: JSON.stringify({ event: "user_signed_up", distinct_id: "user-1" }),
      }) as never
    );

    expect(response.status).toBe(401);
    expect(sendWelcomeEmailOnce).not.toHaveBeenCalled();
  });

  it("sends welcome emails for allowlisted PostHog signup events", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/email/posthog", {
        method: "POST",
        headers: { authorization: "Bearer secret" },
        body: JSON.stringify({ event: "user_signed_up", distinct_id: "user-1" }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "sent" });
    expect(sendWelcomeEmailOnce).toHaveBeenCalledWith({
      userId: "user-1",
      email: "ana@example.com",
      name: "Ana",
    });
  });

  it("can trigger inactivity emails from an allowlisted PostHog event", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/email/posthog", {
        method: "POST",
        headers: { authorization: "Bearer secret" },
        body: JSON.stringify({
          event: "email_inactivity_3d_requested",
          distinct_id: "user-1",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "sent" });
    expect(sendInactivityEmailOnce).toHaveBeenCalledWith({
      userId: "user-1",
      email: "ana@example.com",
      name: "Ana",
      meetingsUsed: 3,
      quotaLimit: 3,
    });
  });
});
