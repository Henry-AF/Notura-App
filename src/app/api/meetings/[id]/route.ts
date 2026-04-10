// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meetings/[id] — Return meeting with tasks, decisions, open_items
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getOwnedMeetingWithRelationsForAuth } from "@/lib/meetings/detail";
import {
  MeetingEditValidationError,
  updateOwnedMeetingForAuth,
} from "@/lib/meetings/edit";

export const GET = withAuth<{ id: string }, NextRequest>(async (
  _request: NextRequest,
  { params, auth }
) => {
  try {
    const result = await getOwnedMeetingWithRelationsForAuth(auth, params.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("[meetings/[id]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
});

export const PATCH = withAuth<{ id: string }, NextRequest>(async (
  request: NextRequest,
  { params, auth }
) => {
  try {
    const body = (await request.json()) as {
      title?: string;
      clientName?: string;
      meetingDate?: string;
    };

    const meeting = await updateOwnedMeetingForAuth(auth, params.id, body);
    return NextResponse.json({
      id: meeting.id,
      title: meeting.title,
      clientName: meeting.client_name,
      meetingDate: meeting.meeting_date,
    });
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

    if (error instanceof MeetingEditValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("[meetings/[id]] Unexpected patch error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
});
