import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryInit = vi.fn();
const sentryCaptureException = vi.fn();
const sentrySetTag = vi.fn();
const sentrySetUser = vi.fn();
const sentrySetExtra = vi.fn();
const sentrySetContext = vi.fn();
const sentrySetLevel = vi.fn();

vi.mock("@sentry/node", () => ({
  init: sentryInit,
  withScope: (callback: (scope: {
    setTag: typeof sentrySetTag;
    setUser: typeof sentrySetUser;
    setExtra: typeof sentrySetExtra;
    setContext: typeof sentrySetContext;
    setLevel: typeof sentrySetLevel;
  }) => void) => {
    callback({
      setTag: sentrySetTag,
      setUser: sentrySetUser,
      setExtra: sentrySetExtra,
      setContext: sentrySetContext,
      setLevel: sentrySetLevel,
    });
  },
  captureException: sentryCaptureException,
}));

describe("observability helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete process.env.SENTRY_DSN;
  });

  it("logs structured records with standard fields", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const mod = await import("./observability");

    mod.logStructured("info", {
      event: "api.request.completed",
      requestId: "req-123",
      route: "/api/stripe/checkout",
      durationMs: 42,
      status: 200,
      userId: "user-123",
    });

    expect(consoleInfo).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(consoleInfo.mock.calls[0][0])) as Record<string, unknown>;

    expect(payload.requestId).toBe("req-123");
    expect(payload.userId).toBe("user-123");
    expect(payload.route).toBe("/api/stripe/checkout");
    expect(payload.durationMs).toBe(42);
    expect(payload.status).toBe(200);
  });

  it("captures production exceptions with Sentry context", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";

    const mod = await import("./observability");
    mod.captureObservedError(new Error("boom"), {
      event: "api.request.failed",
      requestId: "req-999",
      route: "/api/meetings/upload",
      durationMs: 120,
      status: 500,
      userId: "user-999",
    });

    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(sentryCaptureException).toHaveBeenCalledTimes(1);
    expect(sentrySetTag).toHaveBeenCalledWith("route", "/api/meetings/upload");
    expect(sentrySetTag).toHaveBeenCalledWith("status", "500");
    expect(sentrySetUser).toHaveBeenCalledWith({ id: "user-999" });
    expect(sentrySetExtra).toHaveBeenCalledWith("requestId", "req-999");

    vi.unstubAllEnvs();
  });

  it("does not capture Sentry events outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";

    const mod = await import("./observability");
    mod.captureObservedError(new Error("ignored"), {
      event: "api.request.failed",
      requestId: "req-test",
      route: "/api/test",
      durationMs: 5,
      status: 500,
    });

    expect(sentryCaptureException).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
