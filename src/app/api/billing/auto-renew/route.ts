import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getOrCreateBillingAccount } from "@/lib/billing";
import { updateBillingAutoRenew } from "@/lib/billing-gateway";

interface AutoRenewBody {
  enabled?: unknown;
}

type StripeSubscriptionAccount = {
  active_billing_provider?: string | null;
  stripe_subscription_id?: string | null;
};

async function readAutoRenewBody(request: NextRequest): Promise<AutoRenewBody> {
  try {
    return (await request.json()) as AutoRenewBody;
  } catch {
    return {};
  }
}

function getStripeSubscriptionId(account: StripeSubscriptionAccount): string | null {
  if (account.active_billing_provider === "abacatepay") return null;
  return account.stripe_subscription_id ?? null;
}

export const PATCH = withAuth<Record<string, never>, NextRequest>(
  async (request: NextRequest, { auth }) => {
    try {
      const body = await readAutoRenewBody(request);

      if (typeof body.enabled !== "boolean") {
        return NextResponse.json(
          { error: "Payload inválido para renovação automática." },
          { status: 400 }
        );
      }

      const account = await getOrCreateBillingAccount(auth.user.id);
      const status = await updateBillingAutoRenew({
        userId: auth.user.id,
        enabled: body.enabled,
        stripeSubscriptionId: getStripeSubscriptionId(account),
      });

      return NextResponse.json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-auto-renew] Failed to update auto-renew:", message);
      return NextResponse.json(
        { error: "Falha ao atualizar renovação automática." },
        { status: 500 }
      );
    }
  }
);
