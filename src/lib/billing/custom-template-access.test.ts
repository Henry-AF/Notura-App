import { beforeEach, describe, expect, it, vi } from "vitest";

describe("custom template access", () => {
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

  it("blocks custom templates for free plans", async () => {
    const client = createBillingClient({ plan: "free", current_period_end: null });
    const mod = await import("./custom-template-access");

    await expect(
      mod.getCustomTemplateAccess("user-free", client as never)
    ).resolves.toEqual({ canUseCustomTemplates: false, plan: "free" });
  });

  it("blocks custom templates for pro (Starter) plans", async () => {
    const client = createBillingClient({
      plan: "pro",
      current_period_end: "2026-06-27T12:00:00.000Z",
    });
    const mod = await import("./custom-template-access");

    await expect(
      mod.getCustomTemplateAccess(
        "user-1",
        client as never,
        new Date("2026-06-01T12:00:00.000Z")
      )
    ).resolves.toEqual({ canUseCustomTemplates: false, plan: "pro" });
  });

  it("allows custom templates for active team (Pro) plans", async () => {
    const client = createBillingClient({
      plan: "team",
      current_period_end: "2026-06-27T12:00:00.000Z",
    });
    const mod = await import("./custom-template-access");

    await expect(
      mod.getCustomTemplateAccess(
        "user-1",
        client as never,
        new Date("2026-06-01T12:00:00.000Z")
      )
    ).resolves.toEqual({ canUseCustomTemplates: true, plan: "team" });
  });

  it("blocks custom templates once a team subscription has expired", async () => {
    const client = createBillingClient({
      plan: "team",
      current_period_end: "2026-05-29T12:00:00.000Z",
    });
    const mod = await import("./custom-template-access");

    await expect(
      mod.getCustomTemplateAccess(
        "user-expired",
        client as never,
        new Date("2026-06-01T12:00:00.000Z")
      )
    ).resolves.toEqual({ canUseCustomTemplates: false, plan: "team" });
  });

  it("throws a typed pro-required error when a caller requires access", async () => {
    const client = createBillingClient({ plan: "pro", current_period_end: null });
    const mod = await import("./custom-template-access");

    await expect(
      mod.requireCustomTemplateAccess("user-1", client as never)
    ).rejects.toMatchObject({
      name: "CustomTemplateProRequiredError",
      status: 403,
      message: mod.CUSTOM_TEMPLATE_PRO_REQUIRED_MESSAGE,
    });
  });
});
