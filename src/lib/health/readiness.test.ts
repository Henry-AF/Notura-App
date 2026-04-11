import { describe, expect, it } from "vitest";
import {
  getReadinessHttpStatus,
  runReadinessChecks,
  type ReadinessDependencies,
} from "./readiness";

function createDependencies(overrides?: Partial<ReadinessDependencies>): ReadinessDependencies {
  return {
    checkDatabase: async () => undefined,
    checkQueue: async () => undefined,
    checkAssemblyAi: async () => undefined,
    checkGemini: async () => undefined,
    checkR2: async () => undefined,
    ...overrides,
  };
}

describe("readiness checks", () => {
  it("returns ok when all dependencies are healthy", async () => {
    const report = await runReadinessChecks(createDependencies());

    expect(report.status).toBe("ok");
    expect(report.checks.database.status).toBe("ok");
    expect(report.checks.queue.status).toBe("ok");
    expect(report.checks.providers.assemblyai.status).toBe("ok");
    expect(report.checks.providers.gemini.status).toBe("ok");
    expect(report.checks.providers.r2.status).toBe("ok");
    expect(getReadinessHttpStatus(report.status)).toBe(200);
  });

  it("returns degraded when a non-critical provider is unavailable", async () => {
    const report = await runReadinessChecks(
      createDependencies({
        checkGemini: async () => {
          throw new Error("Gemini timeout");
        },
      })
    );

    expect(report.status).toBe("degraded");
    expect(report.checks.providers.gemini.status).toBe("degraded");
    expect(getReadinessHttpStatus(report.status)).toBe(206);
  });

  it("returns down when a critical dependency fails", async () => {
    const report = await runReadinessChecks(
      createDependencies({
        checkDatabase: async () => {
          throw new Error("Supabase unavailable");
        },
      })
    );

    expect(report.status).toBe("down");
    expect(report.checks.database.status).toBe("down");
    expect(getReadinessHttpStatus(report.status)).toBe(503);
  });
});
