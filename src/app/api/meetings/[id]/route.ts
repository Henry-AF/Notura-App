// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meetings/[id] — Return meeting with tasks, decisions, open_items
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import type { MeetingWithRelations } from "@/types/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meetingId = params.id;

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabaseAuth = createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // ── Fetch meeting ────────────────────────────────────────────────────
    const supabase = createServiceRoleClient();

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: "Reunião não encontrada." },
        { status: 404 }
      );
    }

    // ── Authorization: verify ownership ──────────────────────────────────
    if (meeting.user_id !== user.id) {
      return NextResponse.json(
        { error: "Você não tem permissão para acessar esta reunião." },
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
}
