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

const UPSTASH_SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local window_start = now - window

redis.call("ZREMRANGEBYSCORE", key, "-inf", window_start)

local count = tonumber(redis.call("ZCARD", key))
local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")

if count >= limit then
  local oldest_score = tonumber(oldest[2]) or now
  return {0, count, oldest_score}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)

count = count + 1
oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
local oldest_score = tonumber(oldest[2]) or now
return {1, count, oldest_score}
`.trim();

interface UpstashCommandResponse {
  result?: unknown;
  error?: string;
}

interface UpstashRateLimitResult {
  allowed: boolean;
  count: number;
  oldestEntryMs: number;
}

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
  const fromForwardedFor = extractFirstForwardedIp(
    request.headers.get("x-vercel-forwarded-for")
  );
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
  count: number,
  oldestEntryMs: number,
  limited: boolean
): RateLimitSnapshot {
  const resetAtMs = oldestEntryMs + policy.windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
  const remaining = limited ? 0 : Math.max(0, policy.limit - count);

  return {
    limit: policy.limit,
    remaining,
    resetAtMs,
    retryAfterSeconds,
  };
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "Upstash Redis rate limit is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  return { url, token };
}

function createRequestMember(nowMs: number): string {
  const cryptoWithRandomUuid = globalThis.crypto as Crypto | undefined;
  if (cryptoWithRandomUuid?.randomUUID) {
    return `${nowMs}:${cryptoWithRandomUuid.randomUUID()}`;
  }

  return `${nowMs}:${Math.random().toString(36).slice(2)}`;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseUpstashRateLimitResult(
  result: unknown,
  nowMs: number
): UpstashRateLimitResult {
  if (!Array.isArray(result)) {
    throw new Error("Upstash Redis returned an invalid rate limit response.");
  }

  return {
    allowed: parseNumber(result[0], 0) === 1,
    count: parseNumber(result[1], 0),
    oldestEntryMs: parseNumber(result[2], nowMs),
  };
}

async function consumeUpstashRateLimit(input: {
  key: string;
  nowMs: number;
  policy: RateLimitPolicy;
}): Promise<UpstashRateLimitResult> {
  const config = getUpstashConfig();
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      UPSTASH_SLIDING_WINDOW_SCRIPT,
      "1",
      input.key,
      String(input.nowMs),
      String(input.policy.windowMs),
      String(input.policy.limit),
      createRequestMember(input.nowMs),
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash Redis rate limit request failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as UpstashCommandResponse;
  if (body.error) {
    throw new Error(`Upstash Redis rate limit command failed: ${body.error}`);
  }

  return parseUpstashRateLimitResult(body.result, input.nowMs);
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

export async function consumeRateLimit(
  options: ConsumeRateLimitOptions
): Promise<RateLimitDecision> {
  assertPolicy(options.policy);

  const nowMs = options.nowMs ?? Date.now();
  const subjectKey = buildSubjectKey(options.request, options.userId);
  const key = `rl:${options.policy.bucket}:${subjectKey}`;
  const result = await consumeUpstashRateLimit({
    key,
    nowMs,
    policy: options.policy,
  });
  const limited = !result.allowed;
  const snapshot = createSnapshot(
    nowMs,
    options.policy,
    result.count,
    result.oldestEntryMs,
    limited
  );

  return {
    limited,
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
