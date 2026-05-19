import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { ensureBillingCustomer } from "@/lib/billing-gateway";
import type { BillingGatewaySource } from "@/lib/billing-gateway";

interface EnsureCustomerBody {
  source?: BillingGatewaySource;
}

function normalizeCustomerSource(source: unknown): BillingGatewaySource {
  if (source === "settings" || source === "onboarding") return source;
  return "unknown";
}

async function readEnsureCustomerBody(
  request: NextRequest
): Promise<EnsureCustomerBody> {
  try {
    return (await request.json()) as EnsureCustomerBody;
  } catch {
    return {};
  }
}

export const POST = withAuth<Record<string, string>, NextRequest>(
  async (request: NextRequest, { auth }) => {
    try {
      const body = await readEnsureCustomerBody(request);
      const result = await ensureBillingCustomer({
        userId: auth.user.id,
        userEmail: auth.user.email ?? null,
        source: normalizeCustomerSource(body.source),
      });

      if (result.status === "in_progress") {
        return NextResponse.json(
          { success: false, provider: result.provider, inProgress: true },
          { status: 202 }
        );
      }

      return NextResponse.json({
        success: true,
        provider: result.provider,
        customerId: result.customerId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-customer] Failed to prewarm customer:", message);
      return NextResponse.json(
        { error: "Falha ao preparar pagamento." },
        { status: 500 }
      );
    }
  }
);
