import { beforeEach, describe, expect, it, vi } from "vitest";

const sendWelcomeEmailOnce = vi.fn();
const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
    user_metadata: { full_name: "Ana" },
  },
} as never;

vi.mock("@/lib/api/auth", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/email/delivery", () => ({
  sendWelcomeEmailOnce,
}));

describe("POST /api/email/welcome", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sendWelcomeEmailOnce.mockResolvedValue({
      status: "sent",
      deliveryId: "delivery-1",
      resendEmailId: "email-1",
    });
  });

  it("sends a welcome email for the authenticated user without accepting email from the client", async () => {
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/email/welcome", {
        method: "POST",
        body: JSON.stringify({ email: "attacker@example.com" }),
      }) as never,
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "sent" });
    expect(sendWelcomeEmailOnce).toHaveBeenCalledWith({
      userId: "user-1",
      email: "ana@example.com",
      name: "Ana",
    });
  });
});
