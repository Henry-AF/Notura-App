import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RATE_LIMIT_ERROR_CODE,
  RATE_LIMIT_ERROR_MESSAGE,
  attachRateLimitHeaders,
  consumeRateLimit,
  createRateLimitExceededResponse,
} from "./rate-limit";

const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function installUpstashMock() {
  const store = new Map<string, number[]>();
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const command = JSON.parse(String(init?.body)) as string[];
    const key = command[3];
    const nowMs = Number(command[4]);
    const windowMs = Number(command[5]);
    const limit = Number(command[6]);
    const windowStartMs = nowMs - windowMs;
    const entries = (store.get(key) ?? []).filter((entry) => entry > windowStartMs);

    if (entries.length >= limit) {
      store.set(key, entries);
      return Response.json({ result: [0, entries.length, entries[0] ?? nowMs] });
    }

    entries.push(nowMs);
    entries.sort((a, b) => a - b);
    store.set(key, entries);
    return Response.json({ result: [1, entries.length, entries[0] ?? nowMs] });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("rate-limit helper", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://notura-upstash.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "upstash-token";
    installUpstashMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalUpstashUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
    }
    if (originalUpstashToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalUpstashToken;
    }
  });

  it("uses authenticated user id as key and blocks after the limit", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    const first = await consumeRateLimit({
      request,
      userId: "user-123",
      policy: {
        bucket: "test-user-priority",
        limit: 2,
        windowMs: 10_000,
      },
      nowMs: 1_000,
    });
    const second = await consumeRateLimit({
      request,
      userId: "user-123",
      policy: {
        bucket: "test-user-priority",
        limit: 2,
        windowMs: 10_000,
      },
      nowMs: 2_000,
    });
    const third = await consumeRateLimit({
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

  it("falls back to ip when there is no authenticated user", async () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.77, 10.0.0.1",
      },
    });

    const first = await consumeRateLimit({
      request,
      policy: {
        bucket: "test-ip-fallback",
        limit: 1,
        windowMs: 30_000,
      },
      nowMs: 10_000,
    });
    const second = await consumeRateLimit({
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

  it("returns to allow state after the sliding window expires", async () => {
    const request = new Request("http://localhost/api/test");

    const first = await consumeRateLimit({
      request,
      userId: "user-sliding",
      policy: {
        bucket: "test-sliding-window",
        limit: 1,
        windowMs: 1_000,
      },
      nowMs: 100,
    });
    const blocked = await consumeRateLimit({
      request,
      userId: "user-sliding",
      policy: {
        bucket: "test-sliding-window",
        limit: 1,
        windowMs: 1_000,
      },
      nowMs: 200,
    });
    const afterWindow = await consumeRateLimit({
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
    const decision = await consumeRateLimit({
      request: new Request("http://localhost/api/test"),
      userId: "user-429",
      policy: {
        bucket: "test-response",
        limit: 1,
        windowMs: 30_000,
      },
      nowMs: 1_000,
    });

    const blocked = await consumeRateLimit({
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

  it("attaches rate limit headers to success responses", async () => {
    const decision = await consumeRateLimit({
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

  it("persists counters through the configured Upstash Redis REST endpoint", async () => {
    const fetchMock = installUpstashMock();

    const decision = await consumeRateLimit({
      request: new Request("http://localhost/api/test"),
      userId: "user-upstash",
      policy: {
        bucket: "test-upstash",
        limit: 5,
        windowMs: 30_000,
      },
      nowMs: 1_000,
    });

    expect(decision.limited).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://notura-upstash.example",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer upstash-token",
          "content-type": "application/json",
        }),
      })
    );
    const command = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    ) as string[];
    expect(command[0]).toBe("EVAL");
    expect(command[3]).toBe("rl:test-upstash:user:user-upstash");
  });
});
