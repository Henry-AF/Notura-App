import { NextResponse } from "next/server";

export const RATE_LIMIT_ERROR_CODE = "rate_limited";
export const RATE_LIMIT_ERROR_MESSAGE = "Muitas requisições. Tente novamente em instantes.";

export interface RateLimitPolicy {
  bucket: string;
  limit: number;
  windowMs: number;
}

interface ConsumeRateLimitOptions {
  request: Request;
  policy: RateLimitPolicy;
  userId?: string | null;
  nowMs?: number;
}

interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
}

export interface RateLimitDecision extends RateLimitSnapshot {
  limited: boolean;
  key: string;
  headers: Headers;
}

const rateLimitStore = new Map<string, number[]>();

function normalizeUserId(userId?: string | null): string | null {
  if (!userId) return null;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractFirstForwardedIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const [first] = forwardedFor.split(",");
  const ip = first?.trim();
  return ip ? ip : null;
}

export function getClientIp(request: Request): string | null {
  const fromForwardedFor = extractFirstForwardedIp(request.headers.get("x-forwarded-for"));
  if (fromForwardedFor) return fromForwardedFor;

  const fromRealIp = request.headers.get("x-real-ip")?.trim();
  if (fromRealIp) return fromRealIp;

  const reqWithIp = request as Request & { ip?: string | null };
  if (typeof reqWithIp.ip === "string" && reqWithIp.ip.trim()) {
    return reqWithIp.ip.trim();
  }

  return null;
}

function buildSubjectKey(request: Request, userId?: string | null): string {
  const normalizedUserId = normalizeUserId(userId);
  if (normalizedUserId) {
    return `user:${normalizedUserId}`;
  }

  const clientIp = getClientIp(request);
  if (clientIp) {
    return `ip:${clientIp}`;
  }

  return "ip:unknown";
}

function dropExpiredEntries(entries: number[], windowStartMs: number) {
  let index = 0;
  while (index < entries.length && entries[index] <= windowStartMs) {
    index += 1;
  }

  if (index > 0) {
    entries.splice(0, index);
  }
}

function toHeaders(snapshot: RateLimitSnapshot): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(snapshot.limit));
  headers.set("X-RateLimit-Remaining", String(snapshot.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(snapshot.resetAtMs / 1000)));
  headers.set("Retry-After", String(snapshot.retryAfterSeconds));
  return headers;
}

function createSnapshot(
  nowMs: number,
  policy: RateLimitPolicy,
  entries: number[],
  limited: boolean
): RateLimitSnapshot {
  const oldestInWindow = entries[0] ?? nowMs;
  const resetAtMs = oldestInWindow + policy.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
  const remaining = limited ? 0 : Math.max(0, policy.limit - entries.length);

  return {
    limit: policy.limit,
    remaining,
    resetAtMs,
    retryAfterSeconds,
  };
}

function assertPolicy(policy: RateLimitPolicy) {
  if (!policy.bucket.trim()) {
    throw new Error("Rate limit bucket must not be empty.");
  }

  if (!Number.isInteger(policy.limit) || policy.limit <= 0) {
    throw new Error("Rate limit limit must be a positive integer.");
  }

  if (!Number.isInteger(policy.windowMs) || policy.windowMs <= 0) {
    throw new Error("Rate limit windowMs must be a positive integer.");
  }
}

export function consumeRateLimit(options: ConsumeRateLimitOptions): RateLimitDecision {
  assertPolicy(options.policy);

  const nowMs = options.nowMs ?? Date.now();
  const subjectKey = buildSubjectKey(options.request, options.userId);
  const key = `${options.policy.bucket}:${subjectKey}`;
  const entries = rateLimitStore.get(key) ?? [];
  const windowStartMs = nowMs - options.policy.windowMs;

  dropExpiredEntries(entries, windowStartMs);

  if (entries.length >= options.policy.limit) {
    const snapshot = createSnapshot(nowMs, options.policy, entries, true);
    return {
      limited: true,
      key,
      ...snapshot,
      headers: toHeaders(snapshot),
    };
  }

  entries.push(nowMs);
  rateLimitStore.set(key, entries);

  const snapshot = createSnapshot(nowMs, options.policy, entries, false);
  return {
    limited: false,
    key,
    ...snapshot,
    headers: toHeaders(snapshot),
  };
}

export function attachRateLimitHeaders(
  response: Response,
  headers: Headers
): Response {
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export function createRateLimitExceededResponse(
  decision: RateLimitDecision
): NextResponse {
  return NextResponse.json(
    {
      error: RATE_LIMIT_ERROR_MESSAGE,
      code: RATE_LIMIT_ERROR_CODE,
    },
    {
      status: 429,
      headers: decision.headers,
    }
  );
}
