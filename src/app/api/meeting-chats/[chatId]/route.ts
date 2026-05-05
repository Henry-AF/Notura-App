import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";

export const DELETE = withAuth<{ chatId: string }, NextRequest>(async (
  _request: NextRequest,
  { params, auth }
) => {
  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meeting_chats", params.chatId, auth.user.id);

  const { error } = await supabase
    .from("meeting_chats")
    .delete()
    .eq("id", params.chatId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json(
      { error: "Erro ao excluir chat." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
});
