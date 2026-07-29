import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";
import { verifyStripeTrialCheckout } from "@/lib/billing-gateway-providers";

function isBillingGatewayError(error: unknown): error is BillingGatewayError {
  return (
    error instanceof BillingGatewayError ||
    (error instanceof Error &&
      error.name === "BillingGatewayError" &&
      "status" in error)
  );
}

interface VerifyTrialCheckoutBody {
  sessionId?: string | null;
}

async function readVerifyBody(
  request: NextRequest
): Promise<VerifyTrialCheckoutBody> {
  try {
    return (await request.json()) as VerifyTrialCheckoutBody;
  } catch {
    return {};
  }
}

export const POST = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.billingTrialCheckoutVerify,
  async (request: NextRequest, { auth }) => {
    try {
      const body = await readVerifyBody(request);
      const sessionId = body.sessionId?.trim();

      if (!sessionId) {
        return NextResponse.json(
          { error: "Sessão de checkout do trial não informada." },
          { status: 400 }
        );
      }

      const result = await verifyStripeTrialCheckout({
        userId: auth.user.id,
        sessionId,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (isBillingGatewayError(error)) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-trial-verify] Failed to verify trial checkout:", message);
      return NextResponse.json(
        { error: "Falha ao verificar o período de teste." },
        { status: 500 }
      );
    }
  }
);
