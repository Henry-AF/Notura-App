import { describe, expect, it } from "vitest";
import { presentPlanCard } from "./plan-presenter";

describe("presentPlanCard", () => {
  it("maps free plan usage and price", () => {
    expect(
      presentPlanCard({
        plan: "free",
        meetingsThisMonth: 2,
        monthlyLimit: 3,
      })
    ).toEqual({
      title: "Plano Free",
      badgeLabel: "Free",
      priceLabel: "R$0/mês",
      usageLabel: "2 de 3 reuniões este mês",
      usageValueLabel: "67%",
      showProgress: true,
      progressValue: 67,
    });
  });

  it("maps pro plan usage and price", () => {
    expect(
      presentPlanCard({
        plan: "pro",
        meetingsThisMonth: 12,
        monthlyLimit: 30,
      })
    ).toEqual({
      title: "Plano Pro",
      badgeLabel: "Pro",
      priceLabel: "R$79/mês",
      usageLabel: "12 de 30 reuniões este mês",
      usageValueLabel: "40%",
      showProgress: true,
      progressValue: 40,
    });
  });

  it("falls back safely for unknown plan values", () => {
    expect(
      presentPlanCard({
        plan: "team",
        meetingsThisMonth: 4,
        monthlyLimit: 12,
      })
    ).toEqual({
      title: "Plano ativo",
      badgeLabel: "TEAM",
      priceLabel: null,
      usageLabel: "4 de 12 reuniões este mês",
      usageValueLabel: "33%",
      showProgress: true,
      progressValue: 33,
    });
  });

  it("renders unlimited usage without progress bar", () => {
    expect(
      presentPlanCard({
        plan: "enterprise",
        meetingsThisMonth: 48,
        monthlyLimit: null,
      })
    ).toEqual({
      title: "Plano ativo",
      badgeLabel: "ENTERPRISE",
      priceLabel: null,
      usageLabel: "48 reuniões processadas neste mês",
      usageValueLabel: "Sem limite mensal",
      showProgress: false,
      progressValue: null,
    });
  });

  it("clamps progress at one hundred percent", () => {
    expect(
      presentPlanCard({
        plan: "pro",
        meetingsThisMonth: 48,
        monthlyLimit: 30,
      })
    ).toMatchObject({
      usageValueLabel: "100%",
      progressValue: 100,
    });
  });
});
