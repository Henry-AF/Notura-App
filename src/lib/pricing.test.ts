import { describe, expect, it } from "vitest";
import {
  ANNUAL_SAVINGS_LABEL,
  createCheckoutSelection,
  getBillingCycleLabel,
  getPlanPrice,
  getPlanPriceLabel,
  getPlanSummary,
  getPricingPlan,
  resolveInternalPlanForCheckout,
  resolvePricingPlanFromInternalPlan,
} from "./pricing";

describe("pricing config", () => {
  it("returns the correct monthly and yearly prices", () => {
    expect(getPlanPrice("starter", "monthly")).toBe(49);
    expect(getPlanPrice("starter", "yearly")).toBe(39);
    expect(getPlanPrice("pro", "monthly")).toBe(99);
    expect(getPlanPrice("pro", "yearly")).toBe(69);
    expect(getPlanPrice("free", "monthly")).toBe(0);
  });

  it("keeps the commercial Pro quota aligned with the backend team limit", () => {
    expect(getPricingPlan("pro")).toMatchObject({
      monthlyLimit: 100,
      usageShortLabel: "100 reuniões por mês",
    });
    expect(resolveInternalPlanForCheckout("pro")).toBe("team");
  });

  it("maps commercial plans to internal billing plans without changing the database ids", () => {
    expect(resolveInternalPlanForCheckout("starter")).toBe("pro");
    expect(resolveInternalPlanForCheckout("pro")).toBe("team");
    expect(resolvePricingPlanFromInternalPlan("free")).toBe("free");
    expect(resolvePricingPlanFromInternalPlan("pro")).toBe("starter");
    expect(resolvePricingPlanFromInternalPlan("team")).toBe("pro");
  });

  it("exposes consistent billing copy and summaries", () => {
    expect(getBillingCycleLabel("monthly")).toBe("Cobrado mensalmente");
    expect(getBillingCycleLabel("yearly")).toBe("Cobrado anualmente");
    expect(getPlanPriceLabel("pro", "yearly")).toBe("R$ 69");
    expect(getPlanSummary("pro", "yearly")).toBe(
      "Você está assinando o plano Pro Anual por R$ 69/mês."
    );
  });

  it("builds the CTA payload from the same source of truth", () => {
    expect(createCheckoutSelection("starter", "yearly")).toEqual({
      plan: "starter",
      billingCycle: "yearly",
      price: 39,
    });
  });

  it("keeps the annual savings label centralized", () => {
    expect(ANNUAL_SAVINGS_LABEL).toBe("economize 30%");
  });
});
