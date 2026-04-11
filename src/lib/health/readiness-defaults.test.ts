import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();
const checkR2Health = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/r2", () => ({
  checkR2Health,
}));

function createHealthyDbClient() {
  const limit = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ select });

  return { from };
}

function setRequiredHealthEnv() {
  process.env.INNGEST_EVENT_KEY = "evt_key";
  process.env.INNGEST_SIGNING_KEY = "sig_key";
  process.env.ASSEMBLYAI_API_KEY = "aai_key";
  process.env.GEMINI_API_KEY = "gem_key";
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_ACCESS_KEY_ID = "r2_access";
  process.env.R2_SECRET_ACCESS_KEY = "r2_secret";
}

describe("readiness default dependency checks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    delete process.env.INNGEST_EVENT_KEY;
    delete process.env.INNGEST_SIGNING_KEY;
    delete process.env.ASSEMBLYAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;

    createServiceRoleClient.mockReturnValue(createHealthyDbClient());
    checkR2Health.mockResolvedValue(undefined);
  });

  it("marks readiness as down when the queue probe is unavailable", async () => {
    setRequiredHealthEnv();

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const asString = String(url);

      if (asString.includes("api.inngest.com")) {
        return new Response(null, { status: 503 });
      }

      return new Response("{}", { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./readiness");
    const report = await mod.runReadinessChecks();

    expect(report.checks.queue.status).toBe("down");
    expect(report.status).toBe("down");
  });

  it("does not require R2_BUCKET_NAME when using default bucket", async () => {
    setRequiredHealthEnv();

    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./readiness");
    const report = await mod.runReadinessChecks();

    expect(report.checks.providers.r2.status).toBe("ok");
    expect(report.status).toBe("ok");
  });
});
