import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";

type LogLevel = "info" | "warn" | "error";

type LogStatus = number | string;

interface BaseObservedContext {
  event: string;
  requestId: string;
  route: string;
  durationMs: number;
  status: LogStatus;
  userId?: string;
}

interface CaptureObservedErrorContext extends BaseObservedContext {
  extra?: Record<string, unknown>;
}

const sentryState = {
  initialized: false,
};

function getSentryDsn(): string | null {
  const dsn = process.env.SENTRY_DSN?.trim();
  return dsn && dsn.length > 0 ? dsn : null;
}

function shouldCaptureErrors(): boolean {
  return process.env.NODE_ENV === "production" && getSentryDsn() !== null;
}

function ensureSentryInitialized() {
  if (sentryState.initialized) return;

  const dsn = getSentryDsn();
  if (!dsn) return;

  const tracesSampleRateRaw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  const tracesSampleRate = tracesSampleRateRaw
    ? Number(tracesSampleRateRaw)
    : 0;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
  });

  sentryState.initialized = true;
}

function normalizeUserId(userId: string | undefined): string | undefined {
  if (!userId) return undefined;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function serializeLog(
  level: LogLevel,
  payload: BaseObservedContext & Record<string, unknown>
): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  });
}

function getConsoleMethod(level: LogLevel): (...data: unknown[]) => void {
  if (level === "warn") return console.warn;
  if (level === "error") return console.error;
  return console.info;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

export function createRequestId(request: Request): string {
  const headerRequestId = request.headers.get("x-request-id")?.trim();
  if (headerRequestId && headerRequestId.length > 0) {
    return headerRequestId;
  }

  return randomUUID();
}

export function createTraceId(): string {
  return randomUUID();
}

export function getRoutePath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

export function withRequestIdHeader(response: Response, requestId: string): Response {
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

export function logStructured(
  level: LogLevel,
  payload: BaseObservedContext & Record<string, unknown>
) {
  const method = getConsoleMethod(level);
  method(serializeLog(level, payload));
}

export function captureObservedError(
  error: unknown,
  context: CaptureObservedErrorContext
) {
  if (!shouldCaptureErrors()) return;

  ensureSentryInitialized();
  if (!sentryState.initialized) return;

  const normalized = normalizeError(error);
  const userId = normalizeUserId(context.userId);

  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("route", context.route);
    scope.setTag("status", String(context.status));
    scope.setTag("event", context.event);
    scope.setExtra("requestId", context.requestId);
    scope.setExtra("durationMs", context.durationMs);

    if (userId) {
      scope.setUser({ id: userId });
    }

    if (context.extra) {
      scope.setContext("observability", context.extra);
    }

    Sentry.captureException(normalized);
  });
}
