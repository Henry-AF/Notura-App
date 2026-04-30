import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import type { MeetingChat } from "@/types/database";

function mapChat(chat: MeetingChat) {
  return {
    id: chat.id,
    status: chat.status,
    question: chat.question,
    answer: chat.answer,
    fallbackReason: chat.fallback_reason,
    modelConfirmed: chat.model_confirmed,
    sources: chat.sources,
    errorMessage: chat.error_message,
    createdAt: chat.created_at,
    completedAt: chat.completed_at,
  };
}

export const GET = withAuth<{ id: string; chatId: string }, NextRequest>(async (
  _request: NextRequest,
  { params, auth }
) => {
  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", params.id, auth.user.id);

  const { data: chat, error } = await supabase
    .from("meeting_chats")
    .select("*")
    .eq("id", params.chatId)
    .eq("meeting_id", params.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Erro ao carregar chat da reunião." },
      { status: 500 }
    );
  }

  if (!chat) {
    return NextResponse.json({ error: "Chat não encontrado." }, { status: 404 });
  }

  return NextResponse.json(mapChat(chat));
});
