import { describe, expect, it } from "vitest";
import {
  APP_PLAN_IDS,
  getPlanCatalogEntry,
  getPlanDisplayName,
  getPlanPriceLabel,
  getPlanTitle,
  isPaidPlan,
} from "./plans";

describe("plans catalog", () => {
  it("exposes the canonical app plan ids", () => {
    expect(APP_PLAN_IDS).toEqual(["free", "pro", "team"]);
  });

  it("returns canonical free plan details", () => {
    expect(getPlanCatalogEntry("free")).toMatchObject({
      id: "free",
      displayName: "Free",
      monthlyLimit: 3,
      priceInCents: 0,
      usageShortLabel: "3 reuniões grátis",
    });
  });

  it("returns canonical pro plan details", () => {
    expect(getPlanCatalogEntry("pro")).toMatchObject({
      id: "pro",
      displayName: "Starter",
      monthlyLimit: 30,
      priceInCents: 4900,
      usageShortLabel: "30 reuniões por mês",
    });
    expect(getPlanPriceLabel("pro")).toBe("R$ 49");
  });

  it("maps internal team id to the commercial Pro plan details", () => {
    expect(getPlanCatalogEntry("team")).toMatchObject({
      id: "team",
      displayName: "Pro",
      monthlyLimit: null,
      priceInCents: 9900,
      usageShortLabel: "Reuniões ilimitadas",
    });
    expect(getPlanTitle("team")).toBe("Plano Pro");
    expect(getPlanDisplayName("team")).toBe("Pro");
    expect(getPlanPriceLabel("team")).toBe("R$ 99");
  });

  it("identifies paid plans from the same source of truth", () => {
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("team")).toBe(true);
  });
});
