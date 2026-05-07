import { inngest } from "@/lib/inngest";
import { resetSubscriptionPeriod } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

interface AbacatePayRenewalEventData {
  userId: string;
  plan: Exclude<Plan, "free">;
  currentPeriodEnd: string;
  customerId?: string;
}

function parseRenewalEventData(data: unknown): AbacatePayRenewalEventData {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid billing/abacatepay.renewal-confirmed event payload.");
  }

  const value = data as Partial<AbacatePayRenewalEventData>;
  if (!value.userId || !value.currentPeriodEnd) {
    throw new Error("Missing billing/abacatepay.renewal-confirmed identifiers.");
  }
  if (value.plan !== "pro" && value.plan !== "team") {
    throw new Error("Invalid billing/abacatepay.renewal-confirmed plan.");
  }

  return {
    userId: value.userId,
    plan: value.plan,
    currentPeriodEnd: value.currentPeriodEnd,
    ...(value.customerId ? { customerId: value.customerId } : {}),
  };
}

export const applyAbacatePayRenewal = inngest.createFunction(
  {
    id: "billing-abacatepay-renewal-confirmed",
    retries: 3,
    triggers: [{ event: "billing/abacatepay.renewal-confirmed" }],
  },
  async ({ event, step }) => {
    const data = parseRenewalEventData(event.data);
    const supabase = createServiceRoleClient();

    await step.run("reset-subscription-period", () =>
      resetSubscriptionPeriod(
        {
          userId: data.userId,
          plan: data.plan,
          clearAbacatePayPending: true,
          previousPeriodEnd: data.currentPeriodEnd,
          ...(data.customerId ? { abacatepayCustomerId: data.customerId } : {}),
        },
        supabase
      )
    );

    return { userId: data.userId, currentPeriodEnd: data.currentPeriodEnd };
  }
);
