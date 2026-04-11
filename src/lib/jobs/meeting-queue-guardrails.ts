import { NonRetriableError, RetryAfterError } from "inngest";
import { getErrorMessage } from "@/lib/observability";

export type QueueProvider = "assemblyai" | "gemini" | "r2";

interface ProviderPolicy {
  retryAfterMs: number;
}

const PROVIDER_POLICIES: Record<QueueProvider, ProviderPolicy> = {
  assemblyai: { retryAfterMs: 120_000 },
  gemini: { retryAfterMs: 45_000 },
  r2: { retryAfterMs: 30_000 },
};

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 410, 413, 422]);

const RETRYABLE_MESSAGE_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /socket hang up/i,
  /econnreset/i,
  /eai_again/i,
  /network/i,
  /temporarily unavailable/i,
  /rate limit/i,
];

const NON_RETRYABLE_MESSAGE_PATTERNS = [
  /unprocessable transcript/i,
  /invalid/i,
  /malformed/i,
  /forbidden/i,
  /unauthorized/i,
  /not found/i,
  /empty transcript/i,
  /payload/i,
];

export const PROCESS_MEETING_RETRY_ATTEMPTS = 4;

export const PROCESS_MEETING_CONCURRENCY = {
  limit: 1,
  key: "event.data.meetingId",
  scope: "fn" as const,
};

function readStatusCandidate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function extractStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;

  const record = error as Record<string, unknown>;
  const direct = readStatusCandidate(record.status) ?? readStatusCandidate(record.statusCode);
  if (direct !== null) return direct;

  const response = record.response;
  if (!response || typeof response !== "object") return null;

  const responseRecord = response as Record<string, unknown>;
  return readStatusCandidate(responseRecord.status) ?? readStatusCandidate(responseRecord.statusCode);
}

function shouldRetry(statusCode: number | null, message: string): boolean {
  if (statusCode !== null) {
    if (RETRYABLE_STATUS_CODES.has(statusCode)) return true;
    if (NON_RETRYABLE_STATUS_CODES.has(statusCode)) return false;
  }

  return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function shouldFailFast(statusCode: number | null, message: string): boolean {
  if (statusCode !== null && NON_RETRYABLE_STATUS_CODES.has(statusCode)) {
    return true;
  }

  return NON_RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function buildProviderErrorMessage(provider: QueueProvider, message: string): string {
  return `[${provider}] ${message}`;
}

export function toProviderQueueError(
  provider: QueueProvider,
  error: unknown
): NonRetriableError | RetryAfterError {
  const message = getErrorMessage(error);
  const statusCode = extractStatusCode(error);
  const policy = PROVIDER_POLICIES[provider];

  if (shouldRetry(statusCode, message)) {
    return new RetryAfterError(
      buildProviderErrorMessage(provider, `retryable provider failure: ${message}`),
      policy.retryAfterMs,
      { cause: error }
    );
  }

  if (shouldFailFast(statusCode, message)) {
    return new NonRetriableError(
      buildProviderErrorMessage(provider, `non-retryable provider failure: ${message}`),
      { cause: error }
    );
  }

  return new RetryAfterError(
    buildProviderErrorMessage(provider, `provider failure: ${message}`),
    policy.retryAfterMs,
    { cause: error }
  );
}

export function toNonRetriableJobError(message: string, cause?: unknown): NonRetriableError {
  return new NonRetriableError(message, { cause });
}
