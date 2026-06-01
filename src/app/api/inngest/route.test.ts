import { beforeEach, describe, expect, it, vi } from "vitest";

interface InngestServeConfig {
  functions: unknown[];
}

const mocks = vi.hoisted(() => ({
  answerMeetingChat: { id: "answer-meeting-chat" },
  dispatchMeetingChatOutbox: { id: "dispatch-meeting-chat-outbox" },
  handleProcessMeetingFailure: { id: "process-meeting-failure" },
  preindexMeetingRag: { id: "preindex-meeting-rag" },
  processMeeting: { id: "process-meeting" },
  applyAbacatePayRenewal: { id: "billing-abacatepay-renewal-confirmed" },
  renewAbacatePaySubscription: { id: "renew-abacatepay-subscription" },
  sendUserInactivityEmails: { id: "send-user-inactivity-emails" },
  serve: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
  })),
}));

vi.mock("inngest/next", () => ({
  serve: mocks.serve,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { id: "notura" },
}));

vi.mock("@/inngest/process-meeting", () => ({
  processMeeting: mocks.processMeeting,
  handleProcessMeetingFailure: mocks.handleProcessMeetingFailure,
}));

vi.mock("@/inngest/answer-meeting-chat", () => ({
  answerMeetingChat: mocks.answerMeetingChat,
}));

vi.mock("@/inngest/meeting-chat-outbox", () => ({
  dispatchMeetingChatOutbox: mocks.dispatchMeetingChatOutbox,
}));

vi.mock("@/inngest/preindex-meeting-rag", () => ({
  preindexMeetingRag: mocks.preindexMeetingRag,
}));

vi.mock("@/inngest/renew-abacatepay-subscription", () => ({
  renewAbacatePaySubscription: mocks.renewAbacatePaySubscription,
}));

vi.mock("@/inngest/abacatepay-renewal", () => ({
  applyAbacatePayRenewal: mocks.applyAbacatePayRenewal,
}));

vi.mock("@/inngest/user-inactivity-email", () => ({
  sendUserInactivityEmails: mocks.sendUserInactivityEmails,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: vi.fn(),
  createRequestId: () => "request-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  getRoutePath: () => "/api/inngest",
  logStructured: vi.fn(),
  withRequestIdHeader: vi.fn(),
}));

describe("/api/inngest route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("registers the meeting chat answer function", async () => {
    await import("./route");

    const [config] = mocks.serve.mock.calls[0] as [InngestServeConfig];
    expect(config.functions).toEqual(
      expect.arrayContaining([
        mocks.processMeeting,
        mocks.handleProcessMeetingFailure,
        mocks.answerMeetingChat,
        mocks.dispatchMeetingChatOutbox,
        mocks.preindexMeetingRag,
        mocks.renewAbacatePaySubscription,
        mocks.applyAbacatePayRenewal,
        mocks.sendUserInactivityEmails,
      ])
    );
  });
});
