import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { getPostHogClient } from "@/lib/posthog-server";
import { createStripeTrialCheckout } from "@/lib/billing-gateway-providers";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";

function isBillingGatewayError(error: unknown): error is BillingGatewayError {
  return (
    error instanceof BillingGatewayError ||
    (error instanceof Error &&
      error.name === "BillingGatewayError" &&
      "status" in error)
  );
}

export const POST = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.billingTrialCheckout,
  async (request: NextRequest, { auth }) => {
    try {
      const result = await createStripeTrialCheckout({
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        requestOrigin: new URL(request.url).origin,
      });

      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: auth.user.id,
        event: "trial_checkout_started",
        properties: { plan: "team" },
      });

      return NextResponse.json(result);
    } catch (error) {
      if (isBillingGatewayError(error)) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-trial-checkout] Failed to create trial checkout:", message);
      return NextResponse.json(
        { error: "Falha ao iniciar o período de teste." },
        { status: 500 }
      );
    }
  }
);
