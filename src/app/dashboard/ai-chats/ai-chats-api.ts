import { formatRelativeTime } from "@/lib/utils";
import {
  getOwnedMeetingChatHistory,
  type MeetingChatHistory,
  type MeetingChatHistoryItem,
} from "@/lib/meeting-chats/list";
import type {
  AiChatItem,
  AiChatMeetingOption,
  AiChatQuota,
  AiChatsPageData,
} from "./ai-chats-types";
export { filterAiChatsByMeeting } from "./ai-chats-utils";
export type {
  AiChatItem,
  AiChatMeetingOption,
  AiChatQuota,
  AiChatsPageData,
} from "./ai-chats-types";

function formatMeetingTitle(chat: MeetingChatHistoryItem): string {
  const title = chat.meetingTitle?.trim();
  return title || "Reunião sem título";
}

function mapQuota(history: MeetingChatHistory): AiChatQuota {
  const { used, limit, usageDate } = history.quota;
  const remaining = Math.max(limit - used, 0);
  const percentage = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  return { used, limit, remaining, percentage, usageDate };
}

function mapChat(chat: MeetingChatHistoryItem): AiChatItem {
  return {
    id: chat.id,
    meetingId: chat.meetingId,
    meetingTitle: formatMeetingTitle(chat),
    question: chat.question,
    answer: chat.answer,
    status: chat.status,
    fallbackReason: chat.fallbackReason,
    modelConfirmed: chat.modelConfirmed,
    sources: chat.sources,
    errorMessage: chat.errorMessage,
    createdAt: chat.createdAt,
    completedAt: chat.completedAt,
    displayDate: formatRelativeTime(chat.createdAt),
    rawDate: chat.createdAt,
  };
}

function buildMeetingOptions(chats: AiChatItem[]): AiChatMeetingOption[] {
  const optionsByMeeting = new Map<string, AiChatMeetingOption>();

  for (const chat of chats) {
    const current = optionsByMeeting.get(chat.meetingId);
    if (current) {
      current.count += 1;
    } else {
      optionsByMeeting.set(chat.meetingId, {
        id: chat.meetingId,
        label: chat.meetingTitle,
        count: 1,
      });
    }
  }

  return Array.from(optionsByMeeting.values());
}

export function mapAiChatsPageData(history: MeetingChatHistory): AiChatsPageData {
  const chats = history.chats.map(mapChat);
  return {
    chats,
    meetingOptions: buildMeetingOptions(chats),
    quota: mapQuota(history),
  };
}

export async function fetchAiChatsPageData(): Promise<AiChatsPageData> {
  const history = await getOwnedMeetingChatHistory();
  return mapAiChatsPageData(history);
}
