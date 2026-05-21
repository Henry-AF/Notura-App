import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import {
  MeetingGroupValidationError,
  createMeetingGroupForUser,
  getOwnedMeetingGroupsSnapshotForAuth,
} from "@/lib/meeting-groups";

export const GET = withAuth<Record<string, string>, NextRequest>(async (
  _request: NextRequest,
  { auth }
) => {
  try {
    return NextResponse.json(await getOwnedMeetingGroupsSnapshotForAuth(auth));
  } catch (error) {
    console.error("[meeting-groups] failed to list:", error);
    return NextResponse.json(
      { error: "Erro ao carregar grupos." },
      { status: 500 }
    );
  }
});

export const POST = withAuthRateLimit<Record<string, string>, NextRequest>(
  RATE_LIMIT_POLICIES.meetingGroupsCreate,
  async (request: NextRequest, { auth }) => {
  try {
    const body = (await request.json()) as { name?: unknown };
    const group = await createMeetingGroupForUser(
      auth.supabaseAdmin,
      auth.user.id,
      body.name
    );

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Body JSON invalido." }, { status: 400 });
    }

    if (error instanceof MeetingGroupValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[meeting-groups] failed to create:", error);
    return NextResponse.json(
      { error: "Erro ao criar grupo." },
      { status: 500 }
    );
  }
  }
);
