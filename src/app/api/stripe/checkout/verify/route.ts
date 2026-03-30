import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe, isPaidCheckoutSession } from "@/lib/stripe";
import type { Plan } from "@/types/database";

interface VerifyCheckoutBody {
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json()) as VerifyCheckoutBody;
    const sessionId = body.sessionId?.trim();

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

    if (sessionUserId !== user.id || session.client_reference_id !== user.id) {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[stripe-checkout-verify] Failed to verify checkout:", message);
    return NextResponse.json(
      { error: "Falha ao verificar pagamento." },
      { status: 500 }
    );
  }
}
