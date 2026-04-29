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
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
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

function assertBillingAccountLookupTypes() {
  const resetSubscriptionPeriod =
    null as unknown as typeof import("./billing").resetSubscriptionPeriod;
  const downgradeToFree =
    null as unknown as typeof import("./billing").downgradeToFree;

  // @ts-expect-error Billing account lookup requires one account identifier.
  resetSubscriptionPeriod({ now: new Date("2026-04-27T12:00:00.000Z") });

  // @ts-expect-error Billing account lookup requires one account identifier.
  downgradeToFree({ now: new Date("2026-04-27T12:00:00.000Z") });
}

describe("billing helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses billing_accounts.meetings_used as source of truth", async () => {
    const { client, from } = createBillingClient({
      existingAccount: {
        user_id: "user-1",
        plan: "pro",
        meetings_used: 9,
        current_period_end: "2026-05-27T12:00:00.000Z",
      },
    });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");
    const status = await mod.getBillingStatus("user-1");

    expect(status.meetingsThisMonth).toBe(9);
    expect(from).toHaveBeenCalledWith("billing_accounts");
    expect(from).not.toHaveBeenCalledWith("meetings");
  });

  it("classifies free lifetime and paid period quota states", async () => {
    const mod = await import("./billing");
    const now = new Date("2026-04-27T12:00:00.000Z");

    expect(
      mod.getMeetingQuotaStatus(
        { plan: "free", meetings_used: 3, current_period_end: null } as never,
        now
      )
    ).toMatchObject({
      allowed: false,
      code: "lifetime_quota_exceeded",
      quotaLimit: 3,
    });

    expect(
      mod.getMeetingQuotaStatus(
        {
          plan: "pro",
          meetings_used: 12,
          current_period_end: "2026-04-27T11:59:59.000Z",
        } as never,
        now
      )
    ).toMatchObject({
      allowed: false,
      code: "subscription_expired",
      quotaLimit: 30,
    });

    expect(
      mod.getMeetingQuotaStatus(
        {
          plan: "team",
          meetings_used: 100,
          current_period_end: "2026-05-27T12:00:00.000Z",
        } as never,
        now
      )
    ).toMatchObject({
      allowed: false,
      code: "period_quota_exceeded",
      quotaLimit: 100,
    });
  });

  it("consumes meeting quota atomically via rpc helper", async () => {
    const { client, rpc } = createBillingClient({
      rpcValue: {
        meetings_used: 7,
        plan: "pro",
        current_period_start: "2026-04-27T12:00:00.000Z",
        current_period_end: "2026-05-27T12:00:00.000Z",
      },
    });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");
    const value = await mod.consumeMeetingQuota("user-1");

    expect(value).toMatchObject({ meetingsUsed: 7, plan: "pro" });
    expect(rpc).toHaveBeenCalledWith("consume_meeting_quota", {
      p_user_id: "user-1",
    });
  });

  it("accepts an injected Supabase client when consuming meeting quota", async () => {
    const { client, rpc } = createBillingClient({
      rpcValue: {
        meetings_used: 8,
        plan: "team",
        current_period_start: "2026-04-27T12:00:00.000Z",
        current_period_end: "2026-05-27T12:00:00.000Z",
      },
    });
    createServiceRoleClient.mockImplementation(() => {
      throw new Error("service role client should not be created");
    });

    const mod = await import("./billing");
    const value = await mod.consumeMeetingQuota("user-1", client as never);

    expect(value).toMatchObject({ meetingsUsed: 8, plan: "team" });
    expect(rpc).toHaveBeenCalledWith("consume_meeting_quota", {
      p_user_id: "user-1",
    });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("does not expose the removed monthly increment helper", async () => {
    const mod = await import("./billing");

    expect("incrementMeetingsThisMonth" in mod).toBe(false);
  });

  it("refunds meeting quota atomically via rpc helper", async () => {
    const { client, from, rpc } = createBillingClient({
      existingAccount: {
        user_id: "user-1",
        plan: "pro",
        meetings_used: 7,
        meetings_this_month: 7,
      },
    });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");
    await mod.refundMeetingQuota("user-1");

    expect(rpc).toHaveBeenCalledWith("refund_meeting_quota", {
      p_user_id: "user-1",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("resets subscription period for paid plans", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const from = vi.fn().mockReturnValue({ update });
    createServiceRoleClient.mockReturnValue({ from });

    const mod = await import("./billing");
    await mod.resetSubscriptionPeriod({
      userId: "user-1",
      plan: "team",
      now: new Date("2026-04-27T12:00:00.000Z"),
      abacatepayCustomerId: "customer-1",
    });

    expect(update).toHaveBeenCalledWith({
      plan: "team",
      meetings_used: 0,
      current_period_start: "2026-04-27T12:00:00.000Z",
      current_period_end: "2026-05-27T12:00:00.000Z",
      abacatepay_customer_id: "customer-1",
      updated_at: "2026-04-27T12:00:00.000Z",
    });
    expect(updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("clamps subscription period end when renewal starts at the end of a month", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const from = vi.fn().mockReturnValue({ update });
    createServiceRoleClient.mockReturnValue({ from });

    const mod = await import("./billing");
    await mod.resetSubscriptionPeriod({
      userId: "user-1",
      plan: "pro",
      now: new Date("2026-01-31T12:00:00.000Z"),
    });
    await mod.resetSubscriptionPeriod({
      userId: "user-2",
      plan: "pro",
      now: new Date("2026-08-31T12:00:00.000Z"),
    });

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        current_period_end: "2026-02-28T12:00:00.000Z",
      })
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        current_period_end: "2026-09-30T12:00:00.000Z",
      })
    );
  });

  it("does not reset customer renewals for accounts already downgraded to free", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { plan: "free" },
      error: null,
    });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });
    const from = vi.fn().mockReturnValue({ select, update });
    createServiceRoleClient.mockReturnValue({ from });

    const mod = await import("./billing");
    await mod.resetSubscriptionPeriod({
      stripeCustomerId: "cus-1",
      now: new Date("2026-04-27T12:00:00.000Z"),
    });

    expect(selectEq).toHaveBeenCalledWith("stripe_customer_id", "cus-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("downgrades to free without resetting consumed usage", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const from = vi.fn().mockReturnValue({ update });
    createServiceRoleClient.mockReturnValue({ from });

    const mod = await import("./billing");
    await mod.downgradeToFree({
      stripeCustomerId: "cus-1",
      now: new Date("2026-04-27T12:00:00.000Z"),
    });

    expect(update).toHaveBeenCalledWith({
      plan: "free",
      current_period_start: null,
      current_period_end: null,
      updated_at: "2026-04-27T12:00:00.000Z",
    });
    expect(updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus-1");
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

  it("throws quota block errors from rpc codes without guessing a plan limit", async () => {
    const { client, from } = createBillingClient({
      rpcError: {
        code: "BP003",
        message: "translated or formatted provider message",
      },
    });
    createServiceRoleClient.mockReturnValue(client);

    const mod = await import("./billing");

    await expect(mod.consumeMeetingQuota("user-1")).rejects.toMatchObject({
      code: "period_quota_exceeded",
      message: "Você atingiu o limite de reuniões do período atual do seu plano.",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
