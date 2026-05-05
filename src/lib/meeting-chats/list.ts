import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_MEETING_CHAT_DAILY_QUOTA_FEATURE,
  resolveMeetingChatDailyQuotaLimit,
} from "@/lib/ai/usage-limits";
import { requireAuth } from "@/lib/api/auth";
import type { ChatSource } from "@/lib/meetings/rag";
import type { Database, Json, MeetingChat } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

type MeetingChatHistoryRow = Pick<
  MeetingChat,
  | "id"
  | "meeting_id"
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

interface MeetingLookupRow {
  id: string;
  title: string | null;
  client_name: string | null;
  created_at: string;
}

export interface MeetingChatDailyQuota {
  used: number;
  limit: number;
  usageDate: string;
}

export interface MeetingChatHistoryItem {
  id: string;
  meetingId: string;
  meetingTitle: string | null;
  meetingClientName: string | null;
  meetingCreatedAt: string | null;
  status: MeetingChat["status"];
  question: string;
  answer: string | null;
  fallbackReason: string | null;
  modelConfirmed: boolean | null;
  sources: ChatSource[];
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MeetingChatHistory {
  chats: MeetingChatHistoryItem[];
  quota: MeetingChatDailyQuota;
}

function getTodayUsageDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isChatSource(value: unknown): value is ChatSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.chunkId === "string" &&
    typeof source.similarity === "number" &&
    typeof source.text === "string"
  );
}

function normalizeSources(sources: Json): ChatSource[] {
  if (!Array.isArray(sources)) return [];
  return (sources as unknown[]).filter(isChatSource);
}

async function fetchChatRows(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<MeetingChatHistoryRow[]> {
  const { data, error } = await supabase
    .from("meeting_chats")
    .select(
      "id, meeting_id, status, question, answer, fallback_reason, model_confirmed, sources, error_message, created_at, completed_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Erro ao carregar chats de IA.");
  return (data ?? []) as MeetingChatHistoryRow[];
}

async function fetchMeetingRows(
  supabase: SupabaseAdminClient,
  userId: string,
  meetingIds: string[]
): Promise<MeetingLookupRow[]> {
  if (meetingIds.length === 0) return [];

  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, client_name, created_at")
    .eq("user_id", userId)
    .in("id", meetingIds);

  if (error) throw new Error("Erro ao carregar reuniões dos chats.");
  return (data ?? []) as MeetingLookupRow[];
}

async function fetchDailyQuota(
  supabase: SupabaseAdminClient,
  userId: string,
  usageDate: string
): Promise<MeetingChatDailyQuota> {
  const { data, error } = await supabase
    .from("ai_usage_daily")
    .select("used_count, quota_limit, usage_date")
    .eq("user_id", userId)
    .eq("feature", AI_MEETING_CHAT_DAILY_QUOTA_FEATURE)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) throw new Error("Erro ao carregar cota diária de IA.");
  return {
    used: data?.used_count ?? 0,
    limit: data?.quota_limit ?? resolveMeetingChatDailyQuotaLimit(),
    usageDate,
  };
}

function mapChatHistoryItem(
  chat: MeetingChatHistoryRow,
  meetingsById: Map<string, MeetingLookupRow>
): MeetingChatHistoryItem {
  const meeting = meetingsById.get(chat.meeting_id);
  return {
    id: chat.id,
    meetingId: chat.meeting_id,
    meetingTitle: meeting?.title ?? null,
    meetingClientName: meeting?.client_name ?? null,
    meetingCreatedAt: meeting?.created_at ?? null,
    status: chat.status,
    question: chat.question,
    answer: chat.answer,
    fallbackReason: chat.fallback_reason,
    modelConfirmed: chat.model_confirmed,
    sources: normalizeSources(chat.sources),
    errorMessage: chat.error_message,
    createdAt: chat.created_at,
    completedAt: chat.completed_at,
  };
}

export async function getMeetingChatHistoryForUser(
  supabase: SupabaseAdminClient,
  userId: string,
  usageDate = getTodayUsageDate()
): Promise<MeetingChatHistory> {
  const [chats, quota] = await Promise.all([
    fetchChatRows(supabase, userId),
    fetchDailyQuota(supabase, userId, usageDate),
  ]);
  const meetingIds = Array.from(new Set(chats.map((chat) => chat.meeting_id)));
  const meetings = await fetchMeetingRows(supabase, userId, meetingIds);
  const meetingsById = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  return {
    quota,
    chats: chats.map((chat) => mapChatHistoryItem(chat, meetingsById)),
  };
}

export async function getOwnedMeetingChatHistory(): Promise<MeetingChatHistory> {
  const auth = await requireAuth();
  return getMeetingChatHistoryForUser(auth.supabaseAdmin, auth.user.id);
}
