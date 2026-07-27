import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { recordTrialOfferDismissed } from "@/lib/billing";

export const PATCH = withAuthRateLimit<Record<string, never>, NextRequest>(
  RATE_LIMIT_POLICIES.billingTrialDismiss,
  async (_request: NextRequest, { auth }) => {
    try {
      await recordTrialOfferDismissed(auth.user.id);
      return NextResponse.json({ dismissed: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[billing-trial-dismiss] Failed to record trial offer dismissal:", message);
      return NextResponse.json(
        { error: "Falha ao registrar dispensa do trial." },
        { status: 500 }
      );
    }
  }
);
