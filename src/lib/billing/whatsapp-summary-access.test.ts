import { beforeEach, describe, expect, it, vi } from "vitest";

describe("whatsapp summary access", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function createBillingClient(
    account: Record<string, unknown> | null,
    error: Error | null = null
  ) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: account,
      error,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    return { from, select, eq, maybeSingle };
  }

  it("allows WhatsApp summaries only for paid plans loaded from billing_accounts", async () => {
    const client = createBillingClient({
      plan: "pro",
      current_period_end: "2026-06-27T12:00:00.000Z",
    });
    const mod = await import("./whatsapp-summary-access");

    const access = await mod.getWhatsAppSummaryAccess(
      "user-1",
      client as never,
      new Date("2026-06-01T12:00:00.000Z")
    );

    expect(access).toEqual({ canSend: true, plan: "pro" });
    expect(client.from).toHaveBeenCalledWith("billing_accounts");
    expect(client.select).toHaveBeenCalledWith(
      "plan, current_period_end, abacatepay_auto_renew_enabled, abacatepay_renewal_status"
    );
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("treats missing billing accounts and free plans as not allowed", async () => {
    const freeClient = createBillingClient({
      plan: "free",
      current_period_end: null,
    });
    const missingClient = createBillingClient(null);
    const mod = await import("./whatsapp-summary-access");

    await expect(
      mod.getWhatsAppSummaryAccess("user-free", freeClient as never)
    ).resolves.toEqual({ canSend: false, plan: "free" });
    await expect(
      mod.getWhatsAppSummaryAccess("user-missing", missingClient as never)
    ).resolves.toEqual({ canSend: false, plan: "free" });
  });

  it("blocks WhatsApp summaries for paid plans after the subscription period expires", async () => {
    const client = createBillingClient({
      plan: "team",
      current_period_end: "2026-05-29T12:00:00.000Z",
      abacatepay_auto_renew_enabled: true,
      abacatepay_renewal_status: "active",
    });
    const mod = await import("./whatsapp-summary-access");

    await expect(
      mod.getWhatsAppSummaryAccess(
        "user-expired",
        client as never,
        new Date("2026-06-01T12:00:00.000Z")
      )
    ).resolves.toEqual({ canSend: false, plan: "team" });
  });

  it("throws a typed paid-plan error when a caller requires access", async () => {
    const client = createBillingClient({
      plan: "free",
      current_period_end: null,
    });
    const mod = await import("./whatsapp-summary-access");

    await expect(
      mod.requireWhatsAppSummaryPaidPlan("user-1", client as never)
    ).rejects.toMatchObject({
      name: "WhatsAppSummaryPaidPlanRequiredError",
      status: 403,
      message: mod.WHATSAPP_SUMMARY_PAID_PLAN_REQUIRED_MESSAGE,
    });
  });
});
