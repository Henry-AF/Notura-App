import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  MeetingParticipantAccessError,
  MeetingParticipantValidationError,
  listMeetingParticipantsForUser,
  mergeMeetingParticipantsForUser,
  updateMeetingParticipantDisplayNameForUser,
} from "@/lib/meetings/participants";
import type { MeetingParticipant } from "@/types/database";

function serializeParticipant(participant: MeetingParticipant) {
  return {
    id: participant.id,
    displayName: participant.display_name,
    originalName: participant.original_name,
    role: participant.role,
  };
}

function readParticipantUpdateBody(body: unknown) {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};

  return {
    participantId: record.participantId,
    displayName: record.displayName,
    role: record.role,
    mergeIntoParticipantId: record.mergeIntoParticipantId,
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

export const PATCH = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingParticipantsMutate,
  async (request, { params, auth }) => {
    try {
      const body = (await request.json()) as unknown;
      const { participantId, displayName, role, mergeIntoParticipantId } =
        readParticipantUpdateBody(body);
      if (typeof participantId !== "string" || !participantId.trim()) {
        return NextResponse.json(
          { error: "Participante é obrigatório." },
          { status: 400 }
        );
      }

      if (mergeIntoParticipantId !== undefined) {
        if (
          typeof mergeIntoParticipantId !== "string" ||
          !mergeIntoParticipantId.trim()
        ) {
          return NextResponse.json(
            { error: "Participante de destino é obrigatório." },
            { status: 400 }
          );
        }

        const participant = await mergeMeetingParticipantsForUser({
          supabase: auth.supabaseAdmin,
          userId: auth.user.id,
          meetingId: params.id,
          sourceParticipantId: participantId,
          targetParticipantId: mergeIntoParticipantId,
        });

        return NextResponse.json({ participant: serializeParticipant(participant) });
      }

      const participant = await updateMeetingParticipantDisplayNameForUser({
        supabase: auth.supabaseAdmin,
        userId: auth.user.id,
        meetingId: params.id,
        participantId,
        input: { displayName, role },
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
