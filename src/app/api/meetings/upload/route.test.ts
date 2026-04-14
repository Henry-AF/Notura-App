import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const buildR2Key = vi.fn();
const getPresignedUploadUrl = vi.fn();
const getBillingStatus = vi.fn();
const signUploadToken = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/r2", () => ({
  buildR2Key,
  getPresignedUploadUrl,
}));

vi.mock("@/lib/billing", () => ({
  getBillingStatus,
}));

vi.mock("@/lib/meetings/upload-token", () => ({
  signUploadToken,
}));

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

describe("POST /api/meetings/upload", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue({});
    buildR2Key.mockReturnValue("meetings/user-1/123/audio.mp3");
    getPresignedUploadUrl.mockResolvedValue("https://r2.example/upload");
    signUploadToken.mockReturnValue("signed-upload-token");
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "pro" },
      meetingsThisMonth: 0,
      monthlyLimit: 30,
    });
  });

  it("returns a presigned upload URL and r2 key for valid requests", async () => {
    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: "audio.mp3",
          contentType: "audio/mpeg",
          fileSize: 1024,
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      r2Key: "meetings/user-1/123/audio.mp3",
      uploadUrl: "https://r2.example/upload",
      uploadToken: "signed-upload-token",
      method: "PUT",
      expiresInSeconds: 900,
    });
    expect(buildR2Key).toHaveBeenCalledWith("user-1", "audio.mp3");
    expect(getPresignedUploadUrl).toHaveBeenCalledWith(
      "meetings/user-1/123/audio.mp3",
      "audio/mpeg",
      900
    );
    expect(signUploadToken).toHaveBeenCalledWith({
      userId: "user-1",
      r2Key: "meetings/user-1/123/audio.mp3",
      contentType: "audio/mpeg",
      fileSize: 1024,
      expiresAt: expect.any(Number),
    });
  });

  it("rejects files above 500MB", async () => {
    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: "audio.mp3",
          contentType: "audio/mpeg",
          fileSize: 501 * 1024 * 1024,
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Arquivo muito grande (501MB). O limite é 500MB.",
    });
    expect(getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("returns 403 when the monthly plan limit is reached", async () => {
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "free" },
      meetingsThisMonth: 3,
      monthlyLimit: 3,
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: "audio.mp3",
          contentType: "audio/mpeg",
          fileSize: 1024,
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error:
        "Você atingiu o limite do plano Free. Faça upgrade para processar mais reuniões.",
    });
    expect(getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("returns 429 with standard payload and rate limit headers when the limit is reached", async () => {
    createServerSupabase.mockReturnValue(createServerClient({ id: "rate-limit-user" }));

    const mod = await import("./route");

    const callUpload = async () =>
      mod.POST(
        new Request("http://localhost/api/meetings/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: "audio.mp3",
            contentType: "audio/mpeg",
            fileSize: 1024,
          }),
        }) as NextRequest,
        { params: {} } as never
      );

    let response: Response = await callUpload();
    for (let i = 0; i < RATE_LIMIT_POLICIES.meetingsUpload.limit; i += 1) {
      response = await callUpload();
    }

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Muitas requisições. Tente novamente em instantes.",
      code: "rate_limited",
    });
    expect(response.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("x-ratelimit-reset")).toBeTruthy();
    expect(response.headers.get("retry-after")).toBeTruthy();
  });
});
