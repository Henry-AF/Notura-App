type BillingPlan = "free" | "pro";

interface BillingSummary {
  plan: BillingPlan;
  meetingsThisMonth: number;
  monthlyLimit: number;
}

function formatPlanLabel(plan: BillingPlan) {
  return plan === "free" ? "Plano Free" : "Plano Pro";
}

export function summarizeBilling(summary: BillingSummary) {
  const remainingMeetings = summary.monthlyLimit - summary.meetingsThisMonth;

  return {
    label: formatPlanLabel(summary.plan),
    usage: `${summary.meetingsThisMonth} de ${summary.monthlyLimit} reunioes`,
    remainingMeetings,
  };
}
