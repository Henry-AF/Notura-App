import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createBillingCheckout } from "@/lib/billing-gateway";
import type { BillingGatewaySource } from "@/lib/billing-gateway";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: Plan;
  source?: BillingGatewaySource;
}

function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

function normalizeCheckoutSource(source: unknown): BillingGatewaySource {
  return source === "settings" ? "settings" : "onboarding";
}

async function readCheckoutBody(request: NextRequest): Promise<CreateCheckoutBody> {
  try {
    return (await request.json()) as CreateCheckoutBody;
  } catch {
    return {};
  }
}

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.billingCheckout,
  async (request: NextRequest, { auth }) => {
    try {
      const body = await readCheckoutBody(request);
      const plan = body.plan;

      if (!plan || !isPaidPlan(plan)) {
        return NextResponse.json(
          { error: "Plano inválido para checkout." },
          { status: 400 }
        );
      }

      const result = await createBillingCheckout({
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        plan,
        source: normalizeCheckoutSource(body.source),
        requestOrigin: new URL(request.url).origin,
      });

      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-checkout] Failed to create checkout:", message);
      return NextResponse.json(
        { error: "Falha ao iniciar pagamento." },
        { status: 500 }
      );
    }
  }
);
