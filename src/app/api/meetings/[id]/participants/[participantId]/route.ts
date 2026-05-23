import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  MeetingParticipantAccessError,
  MeetingParticipantValidationError,
  updateMeetingParticipantDisplayNameForUser,
} from "@/lib/meetings/participants";
import type { MeetingParticipant } from "@/types/database";

function readDisplayName(body: unknown): unknown {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  return (body as { displayName?: unknown }).displayName;
}

function serializeParticipant(participant: MeetingParticipant) {
  return {
    id: participant.id,
    displayName: participant.display_name,
    originalName: participant.original_name,
    role: participant.role,
  };
}

export const PATCH = withAuthRateLimit<
  { id: string; participantId: string },
  NextRequest
>(
  RATE_LIMIT_POLICIES.meetingParticipantsMutate,
  async (request, { params, auth }) => {
    try {
      const body = (await request.json()) as unknown;
      await requireOwnership(
        auth.supabaseAdmin,
        "meetings",
        params.id,
        auth.user.id
      );

      const participant = await updateMeetingParticipantDisplayNameForUser({
        supabase: auth.supabaseAdmin,
        userId: auth.user.id,
        meetingId: params.id,
        participantId: params.participantId,
        input: { displayName: readDisplayName(body) },
      });

      return NextResponse.json({ participant: serializeParticipant(participant) });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Body JSON inválido." },
          { status: 400 }
        );
      }

      if (error instanceof MeetingParticipantValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error instanceof MeetingParticipantAccessError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      console.error("[meetings/participants] Unexpected patch error:", error);
      return NextResponse.json(
        { error: "Erro interno do servidor." },
        { status: 500 }
      );
    }
  }
);
