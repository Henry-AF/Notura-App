import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { isAbacatePayTimeoutError } from "@/lib/abacatepay";
import {
  AbacatePayCustomerNotReadyError,
  ensureAbacatePayCustomer,
  loadAbacatePayCustomerContext,
} from "@/lib/abacatepay-customer";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const POST = withAuth(async (_request, { auth }) => {
  let userIdForLog = "anonymous";

  try {
    const db = createServiceRoleClient();
    userIdForLog = auth.user.id;

    const context = await loadAbacatePayCustomerContext(db, auth.user.id);
    const result = await ensureAbacatePayCustomer(
      db,
      {
        id: auth.user.id,
        email: auth.user.email ?? null,
      },
      context
    );

    if (result.status === "in_progress") {
      console.log(
        `[abacatepay-customer] customer prewarm user=${auth.user.id} status=in_progress`
      );

      return NextResponse.json(
        {
          success: false,
          inProgress: true,
        },
        { status: 202 }
      );
    }

    console.log(`[abacatepay-customer] customer prewarm user=${auth.user.id} status=ready`);

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
});
