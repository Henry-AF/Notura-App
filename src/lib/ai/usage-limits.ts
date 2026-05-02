import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const AI_MEETING_CHAT_DAILY_QUOTA_FEATURE = "meeting_chat";
export const AI_MEETING_CHAT_DAILY_QUOTA_LIMIT = 10;
export const AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_ERROR =
  "ai_chat_daily_quota_exceeded";
export const AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_SQLSTATE = "AI001";

type SupabaseAdminClient = SupabaseClient<Database>;

interface RefundMeetingChatAiQuotaInput {
  userId: string;
  chatId: string;
  feature?: string;
  reason?: "provider_error";
}

export function resolveMeetingChatDailyQuotaLimit(): number {
  return AI_MEETING_CHAT_DAILY_QUOTA_LIMIT;
}

export function isMeetingChatDailyQuotaExceededError(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  return (
    error.code === AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_SQLSTATE ||
    error.message === AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_ERROR
  );
}

export async function refundMeetingChatAiQuota(
  supabase: SupabaseAdminClient,
  {
    userId,
    chatId,
    feature = AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
    reason = "provider_error",
  }: RefundMeetingChatAiQuotaInput
): Promise<boolean> {
  const { data, error } = await supabase.rpc("refund_meeting_chat_ai_usage", {
    p_user_id: userId,
    p_chat_id: chatId,
    p_ai_feature: feature,
    p_reason: reason,
  });

  if (error) throw new Error(`Failed to refund meeting chat AI quota: ${error.message}`);
  return data === true;
}
