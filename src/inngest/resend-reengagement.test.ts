import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestFunction {
  handler: (input: { step: { run: ReturnType<typeof vi.fn> } }) => Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn((_config: unknown, handler: TestFunction["handler"]) => ({ handler })),
  createServiceRoleClient: vi.fn(),
  listCandidates: vi.fn(),
  markSent: vi.fn(),
  getUserEmailById: vi.fn(),
  sendResendEvent: vi.fn(),
  isResendConfigured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({ inngest: { createFunction: mocks.createFunction } }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: mocks.createServiceRoleClient }));
vi.mock("@/lib/reengagement/email-claims", () => ({
  listReengagementCandidates: mocks.listCandidates,
  markReengagementEmailSent: mocks.markSent,
  REENGAGEMENT_VARIANT: "functional",
}));
vi.mock("@/lib/user/user-email", () => ({ getUserEmailById: mocks.getUserEmailById }));
vi.mock("@/lib/resend", () => ({
  sendResendEvent: mocks.sendResendEvent,
  isResendConfigured: mocks.isResendConfigured,
}));
vi.mock("@/lib/observability", () => ({ logStructured: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ getAppBaseUrl: () => "https://app.notura.com.br" }));

const candidate = {
  userId: "user-1",
  lastMeetingAt: "2026-08-07T00:00:00.000Z",
  daysSinceLastMeeting: 3,
};

describe("scheduled Resend reengagement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isResendConfigured.mockReturnValue(true);
    mocks.createServiceRoleClient.mockReturnValue({ auth: {}, from: vi.fn() });
    mocks.listCandidates.mockResolvedValue([candidate]);
    mocks.getUserEmailById.mockResolvedValue("ana@example.com");
  });

  async function runHandler() {
    await import("./resend-reengagement");
    const fn = mocks.createFunction.mock.results[0]?.value as TestFunction;
    const step = { run: vi.fn((_name: string, callback: () => Promise<unknown>) => callback()) };
    return fn.handler({ step });
  }

  it("is registered as a daily cron", async () => {
    await import("./resend-reengagement");

    expect(mocks.createFunction).toHaveBeenCalledWith(
      expect.objectContaining({ triggers: [{ cron: "0 12 * * *" }] }),
      expect.any(Function)
    );
  });

  it("sends the automation event before recording the claim", async () => {
    await runHandler();

    expect(mocks.sendResendEvent).toHaveBeenCalledWith({
      event: "notura.reengagement_48h",
      email: "ana@example.com",
      payload: {
        user_id: "user-1",
        last_meeting_at: candidate.lastMeetingAt,
        days_since_last_meeting: "3",
        upload_url: "https://app.notura.com.br/dashboard/recording?mode=upload",
        variant: "functional",
      },
    });
    expect(mocks.sendResendEvent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markSent.mock.invocationCallOrder[0]
    );
  });

  it("does not claim when Resend rejects the event", async () => {
    mocks.sendResendEvent.mockRejectedValue(new Error("resend down"));

    await expect(runHandler()).rejects.toThrow("resend down");
    expect(mocks.markSent).not.toHaveBeenCalled();
  });
});
