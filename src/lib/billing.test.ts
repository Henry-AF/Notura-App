import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

function createBillingClient(options?: {
  existingAccount?: Record<string, unknown> | null;
  createdAccount?: Record<string, unknown> | null;
  rpcValue?: number | null;
  rpcError?: { code?: string; message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options?.existingAccount ?? null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  const single = vi.fn().mockResolvedValue({
    data: options?.createdAccount ?? null,
    error: null,
  });
  const insertSelect = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });

  const from = vi.fn().mockReturnValue({
    select,
    insert,
  });

  const rpc = vi.fn().mockResolvedValue({
    data: options?.rpcError ? null : options?.rpcValue ?? 1,
    error: options?.rpcError ?? null,
  });

  return {
    client: { from, rpc },
    from,
    rpc,
  };
}

describe("billing helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses billing_accounts.meetings_this_month as source of truth", async () => {
    const { client, from } = createBillingClient({
      existingAccount: {
        user_id: "user-1",
        plan: "pro",
        meetings_this_month: 9,
      },
    });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");
    const status = await mod.getBillingStatus("user-1");

    expect(status.meetingsThisMonth).toBe(9);
    expect(from).toHaveBeenCalledWith("billing_accounts");
    expect(from).not.toHaveBeenCalledWith("meetings");
  });

  it("increments monthly usage atomically via rpc helper", async () => {
    const { client, rpc } = createBillingClient({ rpcValue: 7 });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");
    const value = await mod.incrementMeetingsThisMonth("user-1", 1);

    expect(value).toBe(7);
    expect(rpc).toHaveBeenCalledWith("increment_billing_meetings_this_month", {
      p_user_id: "user-1",
      p_increment: 1,
    });
  });

  it("maps quota block errors from stable Postgres error codes", async () => {
    const mod = await import("./billing");

    expect(mod.resolveQuotaErrorCode({ code: "BP001", message: "localized" })).toBe(
      "subscription_expired"
    );
    expect(mod.resolveQuotaErrorCode({ code: "BP002", message: "localized" })).toBe(
      "lifetime_quota_exceeded"
    );
    expect(mod.resolveQuotaErrorCode({ code: "BP003", message: "localized" })).toBe(
      "period_quota_exceeded"
    );
  });

  it("does not infer quota block codes from provider error messages", async () => {
    const mod = await import("./billing");

    expect(
      mod.resolveQuotaErrorCode({
        code: "P0001",
        message: "subscription_expired",
      })
    ).toBeNull();
  });

  it("throws quota block errors from rpc codes instead of falling back to local increment", async () => {
    const { client, from } = createBillingClient({
      rpcError: {
        code: "BP001",
        message: "translated or formatted provider message",
      },
    });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");

    await expect(mod.incrementMeetingsThisMonth("user-1", 1)).rejects.toMatchObject({
      code: "subscription_expired",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
