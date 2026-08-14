import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestFunction {
  handler: (input: { step: { run: ReturnType<typeof vi.fn> } }) => Promise<unknown>;
}

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn((_config: unknown, handler: TestFunction["handler"]) => ({ handler })),
  createServiceRoleClient: vi.fn(),
  listCandidates: vi.fn(),
  claimEmail: vi.fn(),
  releaseClaim: vi.fn(),
  getUserEmailById: vi.fn(),
  sendResendEvent: vi.fn(),
  isResendConfigured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({ inngest: { createFunction: mocks.createFunction } }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: mocks.createServiceRoleClient }));
vi.mock("@/lib/reengagement/email-claims", () => ({
  listReengagementCandidates: mocks.listCandidates,
  claimReengagementEmail: mocks.claimEmail,
  releaseReengagementEmailClaim: mocks.releaseClaim,
  REENGAGEMENT_VARIANT: "functional",
}));
vi.mock("@/lib/user/user-email", () => ({ getUserEmailById: mocks.getUserEmailById }));
vi.mock("@/lib/resend", () => ({
  sendResendEvent: mocks.sendResendEvent,
  isResendConfigured: mocks.isResendConfigured,
  ResendRequestError: class extends Error {
    constructor(_operation: string, public readonly status: number, message: string) {
      super(message);
    }
  },
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
    mocks.claimEmail.mockResolvedValue(true);
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

  it("claims before sending the automation event", async () => {
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
    expect(mocks.claimEmail.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendResendEvent.mock.invocationCallOrder[0]
    );
  });

  it("does not send when another execution already owns the claim", async () => {
    mocks.claimEmail.mockResolvedValue(false);

    await expect(runHandler()).resolves.toEqual({ candidates: 1, sent: 0 });
    expect(mocks.sendResendEvent).not.toHaveBeenCalled();
  });

  it("keeps the claim when delivery outcome is ambiguous", async () => {
    mocks.sendResendEvent.mockRejectedValue(new Error("network down"));

    await expect(runHandler()).rejects.toThrow("network down");
    expect(mocks.releaseClaim).not.toHaveBeenCalled();
  });

  it("releases the claim when Resend explicitly rejects the event", async () => {
    const { ResendRequestError } = await import("@/lib/resend");
    mocks.sendResendEvent.mockRejectedValue(
      new ResendRequestError("events/send", 422, "invalid payload")
    );

    await expect(runHandler()).rejects.toThrow("invalid payload");
    expect(mocks.releaseClaim).toHaveBeenCalledWith(candidate, expect.anything());
  });
});
