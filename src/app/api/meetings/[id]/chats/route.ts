import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { inngest } from "@/lib/inngest";
import {
  MeetingChatValidationError,
  validateMeetingChatQuestion,
} from "@/lib/meetings/rag";
import { createTraceId, getErrorMessage, logStructured } from "@/lib/observability";

export const POST = withAuth<{ id: string }, NextRequest>(async (
  request: NextRequest,
  { params, auth }
) => {
  const startedAt = Date.now();
  const requestId = createTraceId();
  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", params.id, auth.user.id);

  let body: { question?: unknown };
  try {
    body = (await request.json()) as { question?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  let question: string;
  try {
    question = validateMeetingChatQuestion(body.question);
  } catch (error) {
    if (error instanceof MeetingChatValidationError) {
      return NextResponse.json({ error: error.reason }, { status: 400 });
    }
    throw error;
  }

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, status, transcript")
    .eq("id", params.id)
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (meeting.status !== "completed") {
    return NextResponse.json({ error: "meeting_not_ready" }, { status: 409 });
  }

  if (!meeting.transcript) {
    return NextResponse.json({ error: "no_transcript" }, { status: 422 });
  }

  const { data: chat, error: chatError } = await supabase
    .rpc("create_meeting_chat_with_outbox", {
      p_user_id: auth.user.id,
      p_meeting_id: params.id,
      p_question: question,
    })
    .single();

  if (chatError || !chat) {
    return NextResponse.json(
      { error: "Erro ao criar chat da reunião." },
      { status: 500 }
    );
  }

  try {
    await inngest.send({
      name: "meeting/chat.outbox.dispatch",
      data: {
        meetingId: params.id,
        userId: auth.user.id,
      },
    });
  } catch (error) {
    logStructured("warn", {
      event: "meeting.chat.outbox.dispatch_kick_failed",
      requestId,
      userId: auth.user.id,
      route: `/api/meetings/${params.id}/chats`,
      durationMs: Date.now() - startedAt,
      status: 202,
      errorMessage: getErrorMessage(error),
    });
  }

  return NextResponse.json(
    { chatId: chat.chat_id, status: chat.status },
    { status: 202 }
  );
});
