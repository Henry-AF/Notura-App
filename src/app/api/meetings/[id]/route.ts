// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meetings/[id] — Return meeting with tasks, decisions, open_items
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import type { MeetingWithRelations } from "@/types/database";

export const GET = withAuth<{ id: string }, NextRequest>(async (
  _request: NextRequest,
  { params, auth }
) => {
  const meetingId = params.id;
  await requireOwnership(auth.supabaseAdmin, "meetings", meetingId, auth.user.id);

  try {
    // ── Fetch meeting ────────────────────────────────────────────────────
    const supabase = auth.supabaseAdmin;

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    // ── Fetch related data ───────────────────────────────────────────────
    const [tasksResult, decisionsResult, openItemsResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("decisions")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("open_items")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
    ]);

    const result: MeetingWithRelations = {
      ...meeting,
      tasks: tasksResult.data ?? [],
      decisions: decisionsResult.data ?? [],
      open_items: openItemsResult.data ?? [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[meetings/[id]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
});
