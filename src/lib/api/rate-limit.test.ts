import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  RATE_LIMIT_ERROR_CODE,
  RATE_LIMIT_ERROR_MESSAGE,
  attachRateLimitHeaders,
  consumeRateLimit,
  createRateLimitExceededResponse,
} from "./rate-limit";

describe("rate-limit helper", () => {
  it("uses authenticated user id as key and blocks after the limit", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    const first = consumeRateLimit({
      request,
      userId: "user-123",
      policy: {
        bucket: "test-user-priority",
        limit: 2,
        windowMs: 10_000,
      },
      nowMs: 1_000,
    });
    const second = consumeRateLimit({
      request,
      userId: "user-123",
      policy: {
        bucket: "test-user-priority",
        limit: 2,
        windowMs: 10_000,
      },
      nowMs: 2_000,
    });
    const third = consumeRateLimit({
      request,
      userId: "user-123",
      policy: {
        bucket: "test-user-priority",
        limit: 2,
        windowMs: 10_000,
      },
      nowMs: 3_000,
    });

    expect(first.limited).toBe(false);
    expect(second.limited).toBe(false);
    expect(third.limited).toBe(true);
    expect(third.headers.get("x-ratelimit-limit")).toBe("2");
    expect(third.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(third.headers.get("retry-after")).toBe("8");
  });

  it("falls back to ip when there is no authenticated user", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.77, 10.0.0.1",
      },
    });

    const first = consumeRateLimit({
      request,
      policy: {
        bucket: "test-ip-fallback",
        limit: 1,
        windowMs: 30_000,
      },
      nowMs: 10_000,
    });
    const second = consumeRateLimit({
      request,
      policy: {
        bucket: "test-ip-fallback",
        limit: 1,
        windowMs: 30_000,
      },
      nowMs: 12_000,
    });

    expect(first.limited).toBe(false);
    expect(second.limited).toBe(true);
  });

  it("returns to allow state after the sliding window expires", () => {
    const request = new Request("http://localhost/api/test");

    const first = consumeRateLimit({
      request,
      userId: "user-sliding",
      policy: {
        bucket: "test-sliding-window",
        limit: 1,
        windowMs: 1_000,
      },
      nowMs: 100,
    });
    const blocked = consumeRateLimit({
      request,
      userId: "user-sliding",
      policy: {
        bucket: "test-sliding-window",
        limit: 1,
        windowMs: 1_000,
      },
      nowMs: 200,
    });
    const afterWindow = consumeRateLimit({
      request,
      userId: "user-sliding",
      policy: {
        bucket: "test-sliding-window",
        limit: 1,
        windowMs: 1_000,
      },
      nowMs: 1_200,
    });

    expect(first.limited).toBe(false);
    expect(blocked.limited).toBe(true);
    expect(afterWindow.limited).toBe(false);
  });

  it("builds standard 429 payload and headers", async () => {
    const decision = consumeRateLimit({
      request: new Request("http://localhost/api/test"),
      userId: "user-429",
      policy: {
        bucket: "test-response",
        limit: 1,
        windowMs: 30_000,
      },
      nowMs: 1_000,
    });

    const blocked = consumeRateLimit({
      request: new Request("http://localhost/api/test"),
      userId: "user-429",
      policy: {
        bucket: "test-response",
        limit: 1,
        windowMs: 30_000,
      },
      nowMs: 2_000,
    });

    expect(decision.limited).toBe(false);
    expect(blocked.limited).toBe(true);

    const response = createRateLimitExceededResponse(blocked);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: RATE_LIMIT_ERROR_MESSAGE,
      code: RATE_LIMIT_ERROR_CODE,
    });
    expect(response.headers.get("x-ratelimit-limit")).toBe("1");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("x-ratelimit-reset")).toBeTruthy();
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("attaches rate limit headers to success responses", () => {
    const decision = consumeRateLimit({
      request: new Request("http://localhost/api/test"),
      userId: "user-headers",
      policy: {
        bucket: "test-attach-headers",
        limit: 5,
        windowMs: 30_000,
      },
      nowMs: 1_000,
    });

    const response = NextResponse.json({ ok: true });
    const withHeaders = attachRateLimitHeaders(response, decision.headers);

    expect(withHeaders.status).toBe(200);
    expect(withHeaders.headers.get("x-ratelimit-limit")).toBe("5");
    expect(withHeaders.headers.get("x-ratelimit-remaining")).toBe("4");
    expect(withHeaders.headers.get("x-ratelimit-reset")).toBeTruthy();
  });
});
