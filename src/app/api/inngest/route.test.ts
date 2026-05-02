import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  answerMeetingChat: { id: "answer-meeting-chat" },
  dispatchMeetingChatOutbox: { id: "dispatch-meeting-chat-outbox" },
  handleProcessMeetingFailure: { id: "process-meeting-failure" },
  processMeeting: { id: "process-meeting" },
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

    expect(mocks.serve).toHaveBeenCalledWith(
      expect.objectContaining({
        functions: expect.arrayContaining([
          mocks.processMeeting,
          mocks.handleProcessMeetingFailure,
          mocks.answerMeetingChat,
          mocks.dispatchMeetingChatOutbox,
        ]),
      })
    );
  });
});
