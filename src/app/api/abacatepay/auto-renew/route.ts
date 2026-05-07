import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { setAbacatePayAutoRenew } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface UpdateAutoRenewBody {
  enabled?: unknown;
}

export const PATCH = withAuth(async (request, { auth }) => {
  let body: UpdateAutoRenewBody;
  try {
    body = (await request.json()) as UpdateAutoRenewBody;
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisicao invalido." },
      { status: 400 }
    );
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled deve ser booleano." },
      { status: 400 }
    );
  }

  try {
    const status = await setAbacatePayAutoRenew(
      auth.user.id,
      body.enabled,
      createServiceRoleClient()
    );
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[abacatepay-auto-renew] update failed:", message);
    return NextResponse.json(
      { error: "Nao foi possivel atualizar a renovacao automatica." },
      { status: 500 }
    );
  }
});
