import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import {
  getOwnedMeetingsForAuth,
  getOwnedMeetingsPageForAuth,
  type MeetingsPageOptions,
} from "@/lib/meetings/list";

function parseMeetingPageOptions(request: NextRequest): MeetingsPageOptions {
  const url = request.nextUrl;
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");
  const groupIdParam = url.searchParams.get("groupId");

  const limit = limitParam ? Number(limitParam) : undefined;
  const cursor = cursorParam ?? undefined;
  const groupId = groupIdParam ?? undefined;

  return { limit, cursor, groupId };
}

function isPaginatedRequest(options: MeetingsPageOptions): boolean {
  return options.limit !== undefined || options.cursor !== undefined;
}

function mapMeetingToResponse(meeting: {
  id: string;
  title: string | null;
  client_name: string | null;
  group_id: string | null;
  group_name: string | null;
  status: string;
  created_at: string;
}) {
  return {
    id: meeting.id,
    title: meeting.title,
    clientName: meeting.client_name,
    groupId: meeting.group_id,
    groupName: meeting.group_name,
    createdAt: meeting.created_at,
    status: meeting.status,
  };
}

export const GET = withAuth<Record<string, never>, NextRequest>(async (
  request: NextRequest,
  { auth }
) => {
  try {
    const options = parseMeetingPageOptions(request);

    if (isPaginatedRequest(options)) {
      const page = await getOwnedMeetingsPageForAuth(auth, options);
      return NextResponse.json({
        meetings: page.meetings.map(mapMeetingToResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      });
    }

    const meetings = await getOwnedMeetingsForAuth(auth);
    return NextResponse.json({
      meetings: meetings.map(mapMeetingToResponse),
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("[api/meetings] failed:", error);
    return NextResponse.json(
      { error: "Erro ao carregar reuniões." },
      { status: 500 }
    );
  }
});
