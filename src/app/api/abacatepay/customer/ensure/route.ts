import { NextResponse } from "next/server";
import { isAbacatePayTimeoutError } from "@/lib/abacatepay";
import {
  AbacatePayCustomerNotReadyError,
  ensureAbacatePayCustomer,
  loadAbacatePayCustomerContext,
} from "@/lib/abacatepay-customer";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  let userIdForLog = "anonymous";

  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    userIdForLog = user.id;

    const context = await loadAbacatePayCustomerContext(supabase, user.id);
    const result = await ensureAbacatePayCustomer(
      supabase,
      {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      context
    );

    if (result.status === "in_progress") {
      console.log(
        `[abacatepay-customer] customer prewarm user=${user.id} status=in_progress`
      );

      return NextResponse.json(
        {
          success: false,
          inProgress: true,
        },
        { status: 202 }
      );
    }

    console.log(`[abacatepay-customer] customer prewarm user=${user.id} status=ready`);

    return NextResponse.json({
      success: true,
      customerId: result.customerId,
    });
  } catch (error) {
    if (isAbacatePayTimeoutError(error)) {
      return NextResponse.json(
        { error: "Preparacao do checkout excedeu o tempo limite." },
        { status: 504 }
      );
    }

    if (error instanceof AbacatePayCustomerNotReadyError) {
      console.log(
        `[abacatepay-customer] customer prewarm user=${userIdForLog} status=in_progress`
      );

      return NextResponse.json(
        {
          success: false,
          inProgress: true,
          error: error.message,
        },
        { status: 202 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[abacatepay-customer] Failed to ensure customer:", message);

    return NextResponse.json(
      { error: "Falha ao preparar cliente do AbacatePay." },
      { status: 500 }
    );
  }
}
