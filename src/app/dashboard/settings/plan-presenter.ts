import { getPlanDisplayName, getPlanPriceLabel, getPlanTitle, isPlan } from "@/lib/plans";

export interface PresentPlanCardInput {
  plan: string | null | undefined;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
}

export interface PlanPresentation {
  title: string;
  badgeLabel: string;
  priceLabel: string | null;
  usageLabel: string;
  usageValueLabel: string | null;
  showProgress: boolean;
  progressValue: number | null;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function presentPlanCard(
  input: PresentPlanCardInput
): PlanPresentation {
  const planKey = input.plan?.trim().toLowerCase();
  const knownPlan = isPlan(planKey)
    ? {
        title: getPlanTitle(planKey),
        badgeLabel: getPlanDisplayName(planKey),
        priceLabel: getPlanPriceLabel(planKey),
      }
    : null;

  if (typeof input.monthlyLimit === "number" && input.monthlyLimit > 0) {
    const progressValue = clampProgress(
      Math.round((input.meetingsThisMonth / input.monthlyLimit) * 100)
    );

    return {
      title: knownPlan?.title ?? "Plano ativo",
      badgeLabel: knownPlan?.badgeLabel ?? (input.plan?.trim().toUpperCase() || "Ativo"),
      priceLabel: knownPlan?.priceLabel ?? null,
      usageLabel: `${input.meetingsThisMonth} de ${input.monthlyLimit} reuniões este mês`,
      usageValueLabel: `${progressValue}%`,
      showProgress: true,
      progressValue,
    };
  }

  return {
    title: knownPlan?.title ?? "Plano ativo",
    badgeLabel: knownPlan?.badgeLabel ?? (input.plan?.trim().toUpperCase() || "Ativo"),
    priceLabel: knownPlan?.priceLabel ?? null,
    usageLabel: `${input.meetingsThisMonth} reuniões processadas neste mês`,
    usageValueLabel: "Sem limite mensal",
    showProgress: false,
    progressValue: null,
  };
}
