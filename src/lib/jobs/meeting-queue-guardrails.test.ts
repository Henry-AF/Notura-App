import { describe, expect, it } from "vitest";
import { NonRetriableError, RetryAfterError } from "inngest";
import {
  PROCESS_MEETING_CONCURRENCY,
  PROCESS_MEETING_RETRY_ATTEMPTS,
  toProviderQueueError,
} from "./meeting-queue-guardrails";

describe("meeting queue guardrails", () => {
  it("defines concurrency per meeting resource", () => {
    expect(PROCESS_MEETING_CONCURRENCY).toEqual({
      limit: 1,
      key: "event.data.meetingId",
      scope: "fn",
    });
  });

  it("sets retry attempts for process meeting job", () => {
    expect(PROCESS_MEETING_RETRY_ATTEMPTS).toBe(4);
  });

  it("maps transient provider failures to RetryAfterError", () => {
    const error = toProviderQueueError("assemblyai", {
      status: 429,
      message: "Too many requests",
    });

    expect(error).toBeInstanceOf(RetryAfterError);
    expect(error.message).toContain("assemblyai");
    expect((error as RetryAfterError).retryAfter).toBe("120");
  });

  it("maps provider timeout to RetryAfterError", () => {
    const error = toProviderQueueError(
      "gemini",
      new Error("request timeout while generating summary")
    );

    expect(error).toBeInstanceOf(RetryAfterError);
    expect((error as RetryAfterError).retryAfter).toBe("45");
  });

  it("maps permanent provider failures to NonRetriableError", () => {
    const error = toProviderQueueError("assemblyai", {
      status: 422,
      message: "Unprocessable transcript",
    });

    expect(error).toBeInstanceOf(NonRetriableError);
    expect(error.message).toContain("non-retryable");
  });
});
