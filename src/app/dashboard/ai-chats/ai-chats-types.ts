import type { ChatSource } from "@/lib/meetings/rag";

export interface AiChatItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  question: string;
  answer: string | null;
  status: "processing" | "completed" | "failed";
  fallbackReason: string | null;
  modelConfirmed: boolean | null;
  sources: ChatSource[];
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  displayDate: string;
  rawDate: string;
}

export interface AiChatMeetingOption {
  id: string;
  label: string;
  count: number;
}

export interface AiChatQuota {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  usageDate: string;
}

export interface AiChatsPageData {
  chats: AiChatItem[];
  meetingOptions: AiChatMeetingOption[];
  quota: AiChatQuota;
}
