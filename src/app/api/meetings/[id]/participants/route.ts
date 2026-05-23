import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { listMeetingParticipantsForUser } from "@/lib/meetings/participants";
import type { MeetingParticipant } from "@/types/database";

function serializeParticipant(participant: MeetingParticipant) {
  return {
    id: participant.id,
    displayName: participant.display_name,
    originalName: participant.original_name,
    role: participant.role,
  };
}

export const GET = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingParticipantsRead,
  async (_request, { params, auth }) => {
    try {
      await requireOwnership(
        auth.supabaseAdmin,
        "meetings",
        params.id,
        auth.user.id
      );

      const rows = await listMeetingParticipantsForUser(
        auth.supabaseAdmin,
        auth.user.id,
        params.id
      );

      return NextResponse.json({
        participants: rows
          .filter((row) => row.role === "participant")
          .map(serializeParticipant),
        entities: rows
          .filter((row) => row.role === "entity")
          .map(serializeParticipant),
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error("[meetings/participants] Unexpected get error:", error);
      return NextResponse.json(
        { error: "Erro interno do servidor." },
        { status: 500 }
      );
    }
  }
);
