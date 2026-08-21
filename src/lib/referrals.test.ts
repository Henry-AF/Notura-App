import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

describe("findActiveReferralCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up an active code by lowercased value", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "code-1", code: "fulano20" }, error: null });
    const eqActive = vi.fn().mockReturnValue({ maybeSingle });
    const eqCode = vi.fn().mockReturnValue({ eq: eqActive });
    const select = vi.fn().mockReturnValue({ eq: eqCode });
    const from = vi.fn().mockReturnValue({ select });
    createServiceRoleClient.mockReturnValue({ from });

    const { findActiveReferralCode } = await import("./referrals");
    const result = await findActiveReferralCode("FULANO20");

    expect(from).toHaveBeenCalledWith("referral_codes");
    expect(eqCode).toHaveBeenCalledWith("code", "fulano20");
    expect(eqActive).toHaveBeenCalledWith("active", true);
    expect(result).toEqual({ id: "code-1", code: "fulano20" });
  });

  it("returns null when no active code matches", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqActive = vi.fn().mockReturnValue({ maybeSingle });
    const eqCode = vi.fn().mockReturnValue({ eq: eqActive });
    const select = vi.fn().mockReturnValue({ eq: eqCode });
    const from = vi.fn().mockReturnValue({ select });
    createServiceRoleClient.mockReturnValue({ from });

    const { findActiveReferralCode } = await import("./referrals");
    const result = await findActiveReferralCode("does-not-exist");

    expect(result).toBeNull();
  });
});

describe("recordReferralConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the referral as converted only if not already converted", async () => {
    const updateQuery = { eq: vi.fn(), is: vi.fn() };
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.is.mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue(updateQuery);
    const from = vi.fn().mockReturnValue({ update });
    createServiceRoleClient.mockReturnValue({ from });

    const { recordReferralConversion } = await import("./referrals");
    await recordReferralConversion("user-1");

    expect(from).toHaveBeenCalledWith("referrals");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ converted_at: expect.any(String) })
    );
    expect(updateQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(updateQuery.is).toHaveBeenCalledWith("converted_at", null);
  });
});
