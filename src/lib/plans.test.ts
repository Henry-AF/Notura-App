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
      usageShortLabel: "Até 3 reuniões",
    });
  });

  it("returns canonical pro plan details", () => {
    expect(getPlanCatalogEntry("pro")).toMatchObject({
      id: "pro",
      displayName: "Pro",
      monthlyLimit: 30,
      priceInCents: 5990,
      usageShortLabel: "Até 30 reuniões",
    });
    expect(getPlanPriceLabel("pro")).toBe("R$ 59,90");
  });

  it("maps internal team id to Platinum plan details", () => {
    expect(getPlanCatalogEntry("team")).toMatchObject({
      id: "team",
      displayName: "Platinum",
      monthlyLimit: null,
      priceInCents: 7990,
      usageShortLabel: "Ilimitado",
    });
    expect(getPlanTitle("team")).toBe("Plano Platinum");
    expect(getPlanDisplayName("team")).toBe("Platinum");
    expect(getPlanPriceLabel("team")).toBe("R$ 79,90");
  });

  it("identifies paid plans from the same source of truth", () => {
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("team")).toBe(true);
  });
});
