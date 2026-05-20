import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createBillingCheckout } from "@/lib/billing-gateway";
import type { BillingGatewaySource } from "@/lib/billing-gateway";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";
import { resolveBillingCycle, type BillingCycle } from "@/lib/pricing";
import { buildSupportWhatsAppUrl } from "@/lib/support-contact";
import type { Plan } from "@/types/database";

interface CreateCheckoutBody {
  plan?: Plan;
  source?: BillingGatewaySource;
  billingCycle?: BillingCycle;
}

function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free"> {
  return plan === "pro" || plan === "team";
}

function normalizeCheckoutSource(source: unknown): BillingGatewaySource {
  return source === "settings" ? "settings" : "onboarding";
}

function isBillingGatewayError(error: unknown): error is BillingGatewayError {
  return (
    error instanceof BillingGatewayError ||
    (error instanceof Error &&
      error.name === "BillingGatewayError" &&
      "status" in error)
  );
}

function buildPaymentReceivedSupportMessage(input: {
  userId: string;
  userEmail: string | null;
}): string {
  const emailLine = input.userEmail ? `Email da conta: ${input.userEmail}.` : "";
  return [
    "Olá, equipe Notura.",
    "Meu pagamento da assinatura foi recebido, mas o plano ainda não foi aplicado automaticamente na minha conta.",
    "Podem verificar com urgência?",
    emailLine,
    `ID da conta: ${input.userId}.`,
  ]
    .filter(Boolean)
    .join(" ");
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
        billingCycle: resolveBillingCycle(body.billingCycle),
      });

      return NextResponse.json(result);
    } catch (error) {
      if (isBillingGatewayError(error)) {
        const body: {
          error: string;
          errorCode?: string;
          supportWhatsappUrl?: string;
        } = { error: error.message };

        if (error.code === "payment_received_plan_pending") {
          body.errorCode = error.code;
          body.supportWhatsappUrl = buildSupportWhatsAppUrl(
            buildPaymentReceivedSupportMessage({
              userId: auth.user.id,
              userEmail: auth.user.email ?? null,
            })
          );
        }

        return NextResponse.json(body, { status: error.status });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-checkout] Failed to create checkout:", message);
      return NextResponse.json(
        { error: "Falha ao iniciar pagamento." },
        { status: 500 }
      );
    }
  }
);
