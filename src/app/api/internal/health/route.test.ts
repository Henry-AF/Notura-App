import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runReadinessChecks = vi.fn();
const getReadinessHttpStatus = vi.fn();

vi.mock("@/lib/health/readiness", () => ({
  runReadinessChecks,
  getReadinessHttpStatus,
}));

describe("GET /api/internal/health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.HEALTHCHECK_TOKEN;
  });

  it("returns readiness payload for external monitors", async () => {
    runReadinessChecks.mockResolvedValue({
      status: "ok",
      checkedAt: "2026-04-11T00:00:00.000Z",
      durationMs: 10,
      checks: {
        database: { status: "ok", required: true, durationMs: 1 },
        queue: { status: "ok", required: true, durationMs: 1 },
        providers: {
          assemblyai: { status: "ok", required: false, durationMs: 1 },
          gemini: { status: "ok", required: false, durationMs: 1 },
          r2: { status: "ok", required: false, durationMs: 1 },
        },
      },
    });
    getReadinessHttpStatus.mockReturnValue(200);

    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/internal/health") as NextRequest,
      undefined
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-health-status")).toBe("ok");
    expect(runReadinessChecks).toHaveBeenCalledTimes(1);
    expect(getReadinessHttpStatus).toHaveBeenCalledWith("ok");
  });

  it("returns 401 when health token is configured but missing", async () => {
    process.env.HEALTHCHECK_TOKEN = "secret-token";

    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/internal/health") as NextRequest,
      undefined
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(runReadinessChecks).not.toHaveBeenCalled();
  });

  it("accepts request when health token matches", async () => {
    process.env.HEALTHCHECK_TOKEN = "secret-token";
    runReadinessChecks.mockResolvedValue({
      status: "degraded",
      checkedAt: "2026-04-11T00:00:00.000Z",
      durationMs: 20,
      checks: {
        database: { status: "ok", required: true, durationMs: 1 },
        queue: { status: "ok", required: true, durationMs: 1 },
        providers: {
          assemblyai: { status: "degraded", required: false, durationMs: 1, message: "timeout" },
          gemini: { status: "ok", required: false, durationMs: 1 },
          r2: { status: "ok", required: false, durationMs: 1 },
        },
      },
    });
    getReadinessHttpStatus.mockReturnValue(206);

    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/internal/health", {
        headers: {
          "x-health-token": "secret-token",
        },
      }) as NextRequest,
      undefined
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("x-health-status")).toBe("degraded");
    expect(runReadinessChecks).toHaveBeenCalledTimes(1);
  });
});
