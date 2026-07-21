import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ata export access", () => {
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

  it("allows ATA export for active pro (Starter) plans", async () => {
    const client = createBillingClient({
      plan: "pro",
      current_period_end: "2026-06-27T12:00:00.000Z",
    });
    const mod = await import("./ata-export-access");

    const access = await mod.getAtaExportAccess(
      "user-1",
      client as never,
      new Date("2026-06-01T12:00:00.000Z")
    );

    expect(access).toEqual({ canExport: true, plan: "pro" });
  });

  it("allows ATA export for active team (Pro) plans", async () => {
    const client = createBillingClient({
      plan: "team",
      current_period_end: "2026-06-27T12:00:00.000Z",
    });
    const mod = await import("./ata-export-access");

    const access = await mod.getAtaExportAccess(
      "user-1",
      client as never,
      new Date("2026-06-01T12:00:00.000Z")
    );

    expect(access).toEqual({ canExport: true, plan: "team" });
  });

  it("blocks ATA export for free plans and missing billing accounts", async () => {
    const freeClient = createBillingClient({ plan: "free", current_period_end: null });
    const missingClient = createBillingClient(null);
    const mod = await import("./ata-export-access");

    await expect(
      mod.getAtaExportAccess("user-free", freeClient as never)
    ).resolves.toEqual({ canExport: false, plan: "free" });
    await expect(
      mod.getAtaExportAccess("user-missing", missingClient as never)
    ).resolves.toEqual({ canExport: false, plan: "free" });
  });

  it("blocks ATA export once the subscription period has expired", async () => {
    const client = createBillingClient({
      plan: "pro",
      current_period_end: "2026-05-29T12:00:00.000Z",
    });
    const mod = await import("./ata-export-access");

    await expect(
      mod.getAtaExportAccess(
        "user-expired",
        client as never,
        new Date("2026-06-01T12:00:00.000Z")
      )
    ).resolves.toEqual({ canExport: false, plan: "pro" });
  });

  it("throws a typed paid-plan error when a caller requires access", async () => {
    const client = createBillingClient({ plan: "free", current_period_end: null });
    const mod = await import("./ata-export-access");

    await expect(
      mod.requireExportPaidPlan("user-1", client as never)
    ).rejects.toMatchObject({
      name: "AtaExportPaidPlanRequiredError",
      status: 403,
      message: mod.ATA_EXPORT_PAID_PLAN_REQUIRED_MESSAGE,
    });
  });
});
