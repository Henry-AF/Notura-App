import { beforeEach, describe, expect, it, vi } from "vitest";

const sendReactEmail = vi.fn();
const posthogCapture = vi.fn();

vi.mock("./resend", () => ({
  sendReactEmail,
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({
    capture: posthogCapture,
  }),
}));

function createEmailDeliveryClient(insertResult: { data?: { id: string } | null; error?: { code?: string; message: string } | null }) {
  const single = vi.fn().mockResolvedValue(insertResult);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });
  const from = vi.fn().mockReturnValue({ insert, update, delete: deleteFn });

  return {
    from,
    insert,
    update,
    eq,
    delete: deleteFn,
    deleteEq,
  };
}

describe("email delivery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sendReactEmail.mockResolvedValue("email-1");
  });

  it("sends welcome email once and records the delivery", async () => {
    const supabase = createEmailDeliveryClient({
      data: { id: "delivery-1" },
      error: null,
    });
    const { sendWelcomeEmailOnce } = await import("./delivery");

    const result = await sendWelcomeEmailOnce(
      { userId: "user-1", email: "ana@example.com", name: "Ana" },
      supabase as never
    );

    expect(result.status).toBe("sent");
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        email_type: "welcome",
        campaign: "welcome",
      })
    );
    expect(sendReactEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        subject: "Bem-vindo ao Notura",
      })
    );
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ resend_email_id: "email-1" })
    );
    expect(posthogCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-1",
        event: "email_welcome_sent",
      })
    );
  });

  it("skips duplicate deliveries without sending email", async () => {
    const supabase = createEmailDeliveryClient({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const { sendWelcomeEmailOnce } = await import("./delivery");

    const result = await sendWelcomeEmailOnce(
      { userId: "user-1", email: "ana@example.com", name: "Ana" },
      supabase as never
    );

    expect(result.status).toBe("skipped");
    expect(sendReactEmail).not.toHaveBeenCalled();
    expect(posthogCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-1",
        event: "email_welcome_skipped",
      })
    );
  });

  it("builds inactivity delivery with quota context", async () => {
    const supabase = createEmailDeliveryClient({
      data: { id: "delivery-1" },
      error: null,
    });
    const { sendInactivityEmailOnce } = await import("./delivery");

    const result = await sendInactivityEmailOnce(
      {
        userId: "user-1",
        email: "ana@example.com",
        name: "Ana",
        meetingsUsed: 3,
        quotaLimit: 3,
      },
      supabase as never
    );

    expect(result.status).toBe("sent");
    expect(sendReactEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        subject: "Faz alguns dias que você não acessa o Notura",
      })
    );
    expect(posthogCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "email_inactivity_3d_sent",
        properties: expect.objectContaining({
          quota_remaining: 0,
          quota_limit: 3,
          meetings_used: 3,
        }),
      })
    );
  });
});
