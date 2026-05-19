import { beforeEach, describe, expect, it, vi } from "vitest";

describe("whatsapp summary access", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function createBillingClient(plan: string | null, error: Error | null = null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: plan ? { plan } : null,
      error,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    return { from, select, eq, maybeSingle };
  }

  it("allows WhatsApp summaries only for paid plans loaded from billing_accounts", async () => {
    const client = createBillingClient("pro");
    const mod = await import("./whatsapp-summary-access");

    const access = await mod.getWhatsAppSummaryAccess("user-1", client as never);

    expect(access).toEqual({ canSend: true, plan: "pro" });
    expect(client.from).toHaveBeenCalledWith("billing_accounts");
    expect(client.select).toHaveBeenCalledWith("plan");
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("treats missing billing accounts and free plans as not allowed", async () => {
    const freeClient = createBillingClient("free");
    const missingClient = createBillingClient(null);
    const mod = await import("./whatsapp-summary-access");

    await expect(
      mod.getWhatsAppSummaryAccess("user-free", freeClient as never)
    ).resolves.toEqual({ canSend: false, plan: "free" });
    await expect(
      mod.getWhatsAppSummaryAccess("user-missing", missingClient as never)
    ).resolves.toEqual({ canSend: false, plan: "free" });
  });

  it("throws a typed paid-plan error when a caller requires access", async () => {
    const client = createBillingClient("free");
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
