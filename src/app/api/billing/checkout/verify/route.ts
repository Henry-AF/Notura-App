import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";
import { verifyBillingCheckout } from "@/lib/billing-gateway";

interface VerifyCheckoutBody {
  sessionId?: string | null;
}

async function readVerifyBody(request: NextRequest): Promise<VerifyCheckoutBody> {
  try {
    return (await request.json()) as VerifyCheckoutBody;
  } catch {
    return {};
  }
}

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.billingCheckoutVerify,
  async (request: NextRequest, { auth }) => {
    try {
      const body = await readVerifyBody(request);
      const result = await verifyBillingCheckout({
        userId: auth.user.id,
        sessionId: body.sessionId ?? null,
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof BillingGatewayError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-checkout-verify] Failed to verify checkout:", message);
      return NextResponse.json(
        { error: "Falha ao verificar pagamento." },
        { status: 500 }
      );
    }
  }
);
