export const AI_MEETING_CHAT_DAILY_QUOTA_FEATURE = "meeting_chat";
export const AI_MEETING_CHAT_DAILY_QUOTA_LIMIT = 10;
export const AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_ERROR =
  "ai_chat_daily_quota_exceeded";
export const AI_MEETING_CHAT_DAILY_QUOTA_EXCEEDED_SQLSTATE = "AI001";

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
