import { NextRequest, NextResponse } from "next/server";
import {
  AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_ERROR,
  AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
  isMeetingChatDailyQuotaExceededError,
  resolveMeetingChatDailyQuotaLimit,
} from "@/lib/ai/usage-limits";
import {
  requireOwnership,
  withAuth,
  type RouteAuthContext,
} from "@/lib/api/auth";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { inngest } from "@/lib/inngest";
import {
  MeetingChatValidationError,
  validateMeetingChatQuestion,
} from "@/lib/meetings/rag";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
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
type SupabaseAdminClient = RouteAuthContext["supabaseAdmin"];

interface DispatchMeetingChatAnswerInput {
  supabase: SupabaseAdminClient;
  chatId: string;
  meetingId: string;
  userId: string;
  requestId: string;
  route: string;
  startedAt: number;
}

interface DispatchWarningInput {
  event: string;
  error: unknown;
  requestId: string;
  userId: string;
  route: string;
  startedAt: number;
  chatId?: string;
  meetingId?: string;
}

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

function logDispatchWarning({
  event,
  error,
  requestId,
  userId,
  route,
  startedAt,
  chatId,
  meetingId,
}: DispatchWarningInput): void {
  const durationMs = Date.now() - startedAt;

  logStructured("warn", {
    event,
    requestId,
    userId,
    route,
    durationMs,
    status: 202,
    errorMessage: getErrorMessage(error),
    chatId,
    meetingId,
  });

  captureObservedError(error, {
    event,
    requestId,
    userId,
    route,
    durationMs,
    status: 202,
    extra: {
      chatId,
      meetingId,
    },
  });
}

async function markMeetingChatOutboxSent(
  supabase: SupabaseAdminClient,
  chatId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("meeting_chat_outbox")
    .update({
      status: "sent",
      sent_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("chat_id", chatId)
    .in("status", ["pending", "processing"]);

  if (error) throw error;
}

async function kickMeetingChatOutboxDispatcher({
  meetingId,
  userId,
}: Pick<DispatchMeetingChatAnswerInput, "meetingId" | "userId">): Promise<void> {
  await inngest.send({
    name: "meeting/chat.outbox.dispatch",
    data: {
      meetingId,
      userId,
    },
  });
}

async function kickOutboxAfterDirectDispatchFailure(
  input: Omit<DispatchMeetingChatAnswerInput, "supabase">,
  error: unknown
): Promise<void> {
  logDispatchWarning({
    event: "meeting.chat.answer.dispatch_failed",
    error,
    requestId: input.requestId,
    userId: input.userId,
    route: input.route,
    startedAt: input.startedAt,
    chatId: input.chatId,
    meetingId: input.meetingId,
  });

  try {
    await kickMeetingChatOutboxDispatcher(input);
  } catch (kickError) {
    logDispatchWarning({
      event: "meeting.chat.outbox.dispatch_kick_failed",
      error: kickError,
      requestId: input.requestId,
      userId: input.userId,
      route: input.route,
      startedAt: input.startedAt,
      chatId: input.chatId,
      meetingId: input.meetingId,
    });
  }
}

async function dispatchMeetingChatAnswerImmediately({
  supabase,
  chatId,
  meetingId,
  userId,
  requestId,
  route,
  startedAt,
}: DispatchMeetingChatAnswerInput): Promise<void> {
  try {
    await inngest.send({
      name: "meeting/chat.answer",
      data: { chatId, meetingId, userId },
    });
  } catch (error) {
    await kickOutboxAfterDirectDispatchFailure(
      {
        meetingId,
        userId,
        chatId,
        requestId,
        route,
        startedAt,
      },
      error
    );
    return;
  }

  try {
    await markMeetingChatOutboxSent(supabase, chatId);
  } catch (error) {
    logDispatchWarning({
      event: "meeting.chat.outbox.mark_sent_failed",
      error,
      requestId,
      userId,
      route,
      startedAt,
      chatId,
      meetingId,
    });
  }
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

    await dispatchMeetingChatAnswerImmediately({
      supabase,
      chatId: chat.chat_id,
      meetingId: params.id,
      userId: auth.user.id,
      requestId,
      route: `/api/meetings/${params.id}/chats`,
      startedAt,
    });

    return NextResponse.json(
      { chatId: chat.chat_id, status: chat.status },
      { status: 202 }
    );
  }
);
