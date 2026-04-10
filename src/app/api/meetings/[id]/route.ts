// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meetings/[id] — Return meeting with tasks, decisions, open_items
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getOwnedMeetingWithRelationsForAuth } from "@/lib/meetings/detail";

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
