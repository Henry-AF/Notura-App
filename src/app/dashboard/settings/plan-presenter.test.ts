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
      priceLabel: "R$ 0,00",
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
      priceLabel: "R$ 59,90",
      usageLabel: "12 de 30 reuniões este mês",
      usageValueLabel: "40%",
      showProgress: true,
      progressValue: 40,
    });
  });

  it("maps platinum plan usage and price from internal team id", () => {
    expect(
      presentPlanCard({
        plan: "team",
        meetingsThisMonth: 4,
        monthlyLimit: null,
      })
    ).toEqual({
      title: "Plano Platinum",
      badgeLabel: "Platinum",
      priceLabel: "R$ 79,90",
      usageLabel: "4 reuniões processadas neste mês",
      usageValueLabel: "Sem limite mensal",
      showProgress: false,
      progressValue: null,
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
