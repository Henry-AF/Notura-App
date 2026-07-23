import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  MeetingGroupValidationError,
  deleteMeetingGroupForUser,
  setMeetingGroupArchivedForUser,
  updateMeetingGroupForUser,
} from "@/lib/meeting-groups";

export const PATCH = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingGroupsMutate,
  async (request: NextRequest, { params, auth }) => {
  try {
    await requireOwnership(
      auth.supabaseAdmin,
      "meeting_groups",
      params.id,
      auth.user.id
    );
    const body = (await request.json()) as { name?: unknown; archived?: unknown };

    const group =
      typeof body.archived === "boolean"
        ? await setMeetingGroupArchivedForUser(
            auth.supabaseAdmin,
            auth.user.id,
            params.id,
            body.archived
          )
        : await updateMeetingGroupForUser(
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
  }
);

export const DELETE = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingGroupsMutate,
  async (_request: NextRequest, { params, auth }) => {
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
  }
);
