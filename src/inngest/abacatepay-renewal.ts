import { inngest } from "@/lib/inngest";
import { resetSubscriptionPeriod } from "@/lib/billing";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
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

function resolveInngestRequestId(eventId: unknown): string {
  if (typeof eventId !== "string") return createTraceId();
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : createTraceId();
}

export const applyAbacatePayRenewal = inngest.createFunction(
  {
    id: "billing-abacatepay-renewal-confirmed",
    retries: 3,
    triggers: [{ event: "billing/abacatepay.renewal-confirmed" }],
  },
  async ({ event, step }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    let data: AbacatePayRenewalEventData | null = null;

    try {
      data = parseRenewalEventData(event.data);
      const renewal = data;
      const supabase = createServiceRoleClient();

      await step.run("reset-subscription-period", () =>
        resetSubscriptionPeriod(
          {
            userId: renewal.userId,
            plan: renewal.plan,
            clearAbacatePayPending: true,
            previousPeriodEnd: renewal.currentPeriodEnd,
            ...(renewal.customerId
              ? { abacatepayCustomerId: renewal.customerId }
              : {}),
          },
          supabase
        )
      );

      return {
        userId: renewal.userId,
        currentPeriodEnd: renewal.currentPeriodEnd,
      };
    } catch (error) {
      const message = getErrorMessage(error);

      logStructured("error", {
        event: "billing.abacatepay.renewal_apply.failed",
        requestId,
        userId: data?.userId,
        route: "inngest/abacatepay-renewal",
        durationMs: Date.now() - startedAt,
        status: "failed",
        errorMessage: message,
      });
      captureObservedError(error, {
        event: "billing.abacatepay.renewal_apply.failed",
        requestId,
        userId: data?.userId,
        route: "inngest/abacatepay-renewal",
        durationMs: Date.now() - startedAt,
        status: "failed",
        extra: {
          functionId: "billing-abacatepay-renewal-confirmed",
          eventName: event.name,
          plan: data?.plan,
          currentPeriodEnd: data?.currentPeriodEnd,
          customerId: data?.customerId,
        },
      });

      throw error;
    }
  }
);
