import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
} from "@/lib/observability";
import { getStripe, isPaidCheckoutSession } from "@/lib/stripe";
import type { Plan } from "@/types/database";

interface VerifyCheckoutBody {
  sessionId?: string;
}

export const POST = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.stripeCheckoutVerify,
  async (request: NextRequest, { auth }) => {
    const startedAt = Date.now();
    const requestId = createTraceId();
    let sessionIdForLog: string | null = null;

    try {
      const body = (await request.json()) as VerifyCheckoutBody;
      const sessionId = body.sessionId?.trim();
      sessionIdForLog = sessionId ?? null;

      if (!sessionId) {
        return NextResponse.json(
          { error: "sessionId é obrigatório." },
          { status: 400 }
        );
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const sessionUserId = session.metadata?.user_id;
      const plan = session.metadata?.plan as Plan | undefined;

      if (sessionUserId !== auth.user.id || session.client_reference_id !== auth.user.id) {
        return NextResponse.json(
          { error: "Sessão de pagamento não pertence ao usuário autenticado." },
          { status: 403 }
        );
      }

      if (!plan || (plan !== "pro" && plan !== "team")) {
        return NextResponse.json(
          { error: "Plano inválido na sessão de checkout." },
          { status: 400 }
        );
      }

      if (session.mode !== "subscription") {
        return NextResponse.json(
          { error: "Sessão de checkout inválida para assinatura." },
          { status: 400 }
        );
      }

      if (!isPaidCheckoutSession(session)) {
        return NextResponse.json(
          { error: "Pagamento ainda não foi confirmado pela Stripe." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        plan,
        paymentStatus: session.payment_status,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("[stripe-checkout-verify] Failed to verify checkout:", message);
      captureObservedError(error, {
        event: "billing.stripe.checkout_verify.failed",
        requestId,
        userId: auth.user.id,
        route: "/api/stripe/checkout/verify",
        durationMs: Date.now() - startedAt,
        status: 500,
        extra: {
          sessionId: sessionIdForLog,
        },
      });
      return NextResponse.json(
        { error: "Falha ao verificar pagamento." },
        { status: 500 }
      );
    }
  }
);
