import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferralCookiePayload } from "@/lib/referral-cookie";

const findActiveReferralCode = vi.fn();

vi.mock("@/lib/referrals", () => ({
  findActiveReferralCode,
}));

describe("GET /r/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the referral cookie and redirects to signup for a valid code", async () => {
    findActiveReferralCode.mockResolvedValue({ id: "code-1", code: "fulano20" });

    const { GET } = await import("./route");
    const response = await GET(new Request("https://app.notura.com.br/r/FULANO20"), {
      params: Promise.resolve({ code: "FULANO20" }),
    });

    expect(findActiveReferralCode).toHaveBeenCalledWith("FULANO20");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.notura.com.br/signup");

    const cookie = response.cookies.get("notura_referral");
    expect(cookie).toBeDefined();
    const payload = JSON.parse(
      decodeURIComponent(cookie!.value)
    ) as ReferralCookiePayload;
    expect(payload.code).toBe("fulano20");
    expect(typeof payload.clickedAt).toBe("string");
  });

  it("redirects to signup without a cookie for an invalid code", async () => {
    findActiveReferralCode.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://app.notura.com.br/r/does-not-exist"), {
      params: Promise.resolve({ code: "does-not-exist" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.notura.com.br/signup");
    expect(response.cookies.get("notura_referral")).toBeUndefined();
  });
});
