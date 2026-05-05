import { AiChatsClient } from "./ai-chats-client";
import { AI_MEETING_CHAT_DAILY_QUOTA_LIMIT } from "@/lib/ai/usage-limits";
import { fetchAiChatsPageData } from "./ai-chats-api";
import type { AiChatsPageData } from "./ai-chats-types";

function createEmptyAiChatsPageData(): AiChatsPageData {
  return {
    chats: [],
    meetingOptions: [],
    quota: {
      used: 0,
      limit: AI_MEETING_CHAT_DAILY_QUOTA_LIMIT,
      remaining: AI_MEETING_CHAT_DAILY_QUOTA_LIMIT,
      percentage: 0,
      usageDate: new Date().toISOString().slice(0, 10),
    },
  };
}

export default async function AiChatsPage() {
  let initialData = createEmptyAiChatsPageData();

  try {
    initialData = await fetchAiChatsPageData();
  } catch {
    initialData = createEmptyAiChatsPageData();
  }

  return <AiChatsClient initialData={initialData} />;
}
