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
  createFunction: vi.fn(
    (_config: unknown, handler: TestInngestFunction["handler"]) => ({ handler })
  ),
  createServiceRoleClient: vi.fn(),
  hasTrialEmailEventBeenSent: vi.fn(),
  markTrialEmailEventSent: vi.fn(),
  getUserEmailById: vi.fn(),
  sendResendEvent: vi.fn(),
  isResendConfigured: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { createFunction: mocks.createFunction },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/billing/trial-email-claims", () => ({
  hasTrialEmailEventBeenSent: mocks.hasTrialEmailEventBeenSent,
  markTrialEmailEventSent: mocks.markTrialEmailEventSent,
}));

vi.mock("@/lib/user/user-email", () => ({
  getUserEmailById: mocks.getUserEmailById,
}));

vi.mock("@/lib/resend", () => ({
  sendResendEvent: mocks.sendResendEvent,
  isResendConfigured: mocks.isResendConfigured,
}));

vi.mock("@/lib/observability", () => ({
  logStructured: mocks.logStructured,
}));

function createStep(): TestStep {
  return {
    run: vi.fn((_name: string, callback: () => Promise<unknown>) => callback()),
  };
}

const eventData = {
  resendEvent: "notura.trial_started",
  userId: "user-1",
  claimColumn: "trial_started_email_event_at",
  payload: { user_id: "user-1", trial_start_at: "2026-08-06T00:00:00.000Z" },
};

describe("email/resend.trial-event", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createServiceRoleClient.mockReturnValue({ from: vi.fn() });
    mocks.isResendConfigured.mockReturnValue(true);
    mocks.hasTrialEmailEventBeenSent.mockResolvedValue(false);
    mocks.markTrialEmailEventSent.mockResolvedValue(true);
  });

  async function getHandler() {
    await import("./resend-trial-events");
    return mocks.createFunction.mock.results[0]?.value as TestInngestFunction;
  }

  it("sends the Resend event and only then marks it as sent", async () => {
    mocks.getUserEmailById.mockResolvedValue("ana@example.com");
    const { handler } = await getHandler();
    const step = createStep();

    await handler({ event: { data: eventData }, step });

    expect(mocks.sendResendEvent).toHaveBeenCalledWith({
      event: "notura.trial_started",
      email: "ana@example.com",
      payload: eventData.payload,
    });
    expect(mocks.sendResendEvent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markTrialEmailEventSent.mock.invocationCallOrder[0]
    );
  });

  it("does not call Resend when the event was already sent", async () => {
    mocks.hasTrialEmailEventBeenSent.mockResolvedValue(true);
    const { handler } = await getHandler();
    const step = createStep();

    await handler({ event: { data: eventData }, step });

    expect(mocks.getUserEmailById).not.toHaveBeenCalled();
    expect(mocks.sendResendEvent).not.toHaveBeenCalled();
  });

  it("does not call Resend when the user's email cannot be resolved", async () => {
    mocks.getUserEmailById.mockResolvedValue(null);
    const { handler } = await getHandler();
    const step = createStep();

    await handler({ event: { data: eventData }, step });

    expect(mocks.sendResendEvent).not.toHaveBeenCalled();
    expect(mocks.markTrialEmailEventSent).not.toHaveBeenCalled();
  });

  it("keeps the event eligible for retry when Resend rejects", async () => {
    mocks.getUserEmailById.mockResolvedValue("ana@example.com");
    mocks.sendResendEvent.mockRejectedValue(new Error("resend down"));
    const { handler } = await getHandler();
    const step = createStep();

    await expect(handler({ event: { data: eventData }, step })).rejects.toThrow(
      "resend down"
    );
    expect(mocks.markTrialEmailEventSent).not.toHaveBeenCalled();
  });

  it("ends without claiming or sending when Resend is not configured", async () => {
    mocks.isResendConfigured.mockReturnValue(false);
    const { handler } = await getHandler();
    const step = createStep();

    await handler({ event: { data: eventData }, step });

    expect(mocks.hasTrialEmailEventBeenSent).not.toHaveBeenCalled();
    expect(mocks.markTrialEmailEventSent).not.toHaveBeenCalled();
    expect(mocks.sendResendEvent).not.toHaveBeenCalled();
  });
});
