import { NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";

export const POST = withAuthRateLimit<{ id: string }>(
  RATE_LIMIT_POLICIES.meetingExport,
  async (_request: Request, { params, auth }) => {
  await requireOwnership(auth.supabaseAdmin, "meetings", params.id, auth.user.id);
  return NextResponse.json({ success: true, meetingId: params.id });
  }
);
