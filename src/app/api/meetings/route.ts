import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getOwnedMeetingsForAuth } from "@/lib/meetings/list";

export const GET = withAuth<Record<string, string>, NextRequest>(async (
  _request: NextRequest,
  { auth }
) => {
  try {
    const meetings = await getOwnedMeetingsForAuth(auth);

    return NextResponse.json({
      meetings: meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        clientName: meeting.client_name,
        createdAt: meeting.created_at,
        status: meeting.status,
      })),
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
