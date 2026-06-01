import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withPublicRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { getBillingStatus } from "@/lib/billing";
import {
  sendInactivityEmailOnce,
  sendWelcomeEmailOnce,
} from "@/lib/email/delivery";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface PostHogEmailPayload {
  event?: unknown;
  distinct_id?: unknown;
  distinctId?: unknown;
}

function hasValidSecret(request: Request): boolean {
  const secret = process.env.POSTHOG_EMAIL_WEBHOOK_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-notura-email-webhook-secret");
  return (
    safeEqual(authorization, `Bearer ${secret}`) ||
    safeEqual(headerSecret, secret)
  );
}

function safeEqual(value: string | null, expected: string): boolean {
  if (!value) return false;

  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (valueBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function readUserId(payload: PostHogEmailPayload): string | null {
  const distinctId = payload.distinct_id ?? payload.distinctId;
  return typeof distinctId === "string" && distinctId.trim() ? distinctId : null;
}

function readName(metadata: Record<string, unknown> | undefined): string | null {
  const fullName = metadata?.full_name;
  return typeof fullName === "string" && fullName.trim() ? fullName : null;
}

async function loadRecipient(userId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(`Failed to load PostHog email recipient: ${error.message}`);
  }

  if (!data.user?.email) return null;

  return {
    userId: data.user.id,
    email: data.user.email,
    name: readName(data.user.user_metadata),
  };
}

export const POST = withPublicRateLimit<NextRequest>(
  RATE_LIMIT_POLICIES.posthogEmailWebhook,
  async (request: NextRequest) => {
    if (!hasValidSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as PostHogEmailPayload;
    if (
      payload.event !== "user_signed_up" &&
      payload.event !== "email_inactivity_3d_requested"
    ) {
      return NextResponse.json({ status: "ignored" });
    }

    const userId = readUserId(payload);
    if (!userId) {
      return NextResponse.json({ error: "Missing distinct_id" }, { status: 400 });
    }

    const recipient = await loadRecipient(userId);
    if (!recipient) {
      return NextResponse.json({ status: "skipped", reason: "missing_email" });
    }

    if (payload.event === "email_inactivity_3d_requested") {
      const billing = await getBillingStatus(recipient.userId);
      const result = await sendInactivityEmailOnce({
        ...recipient,
        meetingsUsed: billing.meetingsUsed,
        quotaLimit: billing.quotaStatus.quotaLimit,
      });
      return NextResponse.json({ status: result.status });
    }

    const result = await sendWelcomeEmailOnce(recipient);
    return NextResponse.json({ status: result.status });
  }
);
