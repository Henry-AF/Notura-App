import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { getMeetingGroupDashboardForUser } from "@/lib/meeting-groups";

export const GET = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingGroupsRead,
  async (_request: NextRequest, { params, auth }) => {
    try {
      await requireOwnership(
        auth.supabaseAdmin,
        "meeting_groups",
        params.id,
        auth.user.id
      );
      const dashboard = await getMeetingGroupDashboardForUser(
        auth.supabaseAdmin,
        auth.user.id,
        params.id
      );

      return NextResponse.json({ dashboard });
    } catch (error) {
      if (error instanceof Response) return error;

      console.error("[meeting-groups/[id]/dashboard] failed to load:", error);
      return NextResponse.json(
        { error: "Erro ao carregar indicadores do grupo." },
        { status: 500 }
      );
    }
  }
);
