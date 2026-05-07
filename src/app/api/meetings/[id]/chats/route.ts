import { NextRequest, NextResponse } from "next/server";
import {
  AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_ERROR,
  AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
  isMeetingChatDailyQuotaExceededError,
  resolveMeetingChatDailyQuotaLimit,
} from "@/lib/ai/usage-limits";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { inngest } from "@/lib/inngest";
import {
  MeetingChatValidationError,
  validateMeetingChatQuestion,
} from "@/lib/meetings/rag";
import { createTraceId, getErrorMessage, logStructured } from "@/lib/observability";
import type { MeetingChat } from "@/types/database";

type MeetingChatListRow = Pick<
  MeetingChat,
  | "id"
  | "status"
  | "question"
  | "answer"
  | "fallback_reason"
  | "model_confirmed"
  | "sources"
  | "error_message"
  | "created_at"
  | "completed_at"
>;

function mapChat(chat: MeetingChatListRow) {
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

export const GET = withAuth<{ id: string }, NextRequest>(async (
  _request: NextRequest,
  { params, auth }
) => {
  const supabase = auth.supabaseAdmin;
  await requireOwnership(supabase, "meetings", params.id, auth.user.id);

  const { data, error } = await supabase
    .from("meeting_chats")
    .select(
      "id, status, question, answer, fallback_reason, model_confirmed, sources, error_message, created_at, completed_at"
    )
    .eq("meeting_id", params.id)
    .eq("user_id", auth.user.id)
    .in("status", ["completed", "failed"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Erro ao carregar chats da reunião." },
      { status: 500 }
    );
  }

  return NextResponse.json(((data ?? []) as MeetingChatListRow[]).map(mapChat));
});

export const POST = withAuthRateLimit<{ id: string }, NextRequest>(
  RATE_LIMIT_POLICIES.meetingAiChatCreate,
  async (request: NextRequest, { params, auth }) => {
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

    const dailyQuotaLimit = resolveMeetingChatDailyQuotaLimit();
    const { data: chat, error: chatError } = await supabase
      .rpc("create_meeting_chat_with_outbox", {
        p_user_id: auth.user.id,
        p_meeting_id: params.id,
        p_question: question,
        p_ai_feature: AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
        p_ai_daily_quota_limit: dailyQuotaLimit,
      })
      .single();

    if (chatError) {
      if (isMeetingChatDailyQuotaExceededError(chatError)) {
        return NextResponse.json(
          {
            error: AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_ERROR,
            quotaLimit: dailyQuotaLimit,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Erro ao criar chat da reunião." },
        { status: 500 }
      );
    }

    if (!chat) {
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
  }
);
