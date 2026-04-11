import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";

export const POST = withAuth<{ id: string }>(async (
  _request: Request,
  { params, auth }
) => {
  await requireOwnership(auth.supabaseAdmin, "meetings", params.id, auth.user.id);
  return NextResponse.json({ success: true, meetingId: params.id });
});
