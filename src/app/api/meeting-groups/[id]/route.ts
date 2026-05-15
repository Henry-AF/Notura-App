import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import {
  MeetingGroupValidationError,
  deleteMeetingGroupForUser,
  updateMeetingGroupForUser,
} from "@/lib/meeting-groups";

export const PATCH = withAuth<{ id: string }, NextRequest>(async (
  request: NextRequest,
  { params, auth }
) => {
  try {
    await requireOwnership(
      auth.supabaseAdmin,
      "meeting_groups",
      params.id,
      auth.user.id
    );
    const body = (await request.json()) as { name?: unknown };
    const group = await updateMeetingGroupForUser(
      auth.supabaseAdmin,
      auth.user.id,
      params.id,
      body.name
    );

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Body JSON invalido." }, { status: 400 });
    }
    if (error instanceof MeetingGroupValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[meeting-groups/[id]] failed to update:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar grupo." },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth<{ id: string }, NextRequest>(async (
  _request: NextRequest,
  { params, auth }
) => {
  try {
    await requireOwnership(
      auth.supabaseAdmin,
      "meeting_groups",
      params.id,
      auth.user.id
    );
    await deleteMeetingGroupForUser(auth.supabaseAdmin, auth.user.id, params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("[meeting-groups/[id]] failed to delete:", error);
    return NextResponse.json(
      { error: "Erro ao deletar grupo." },
      { status: 500 }
    );
  }
});
