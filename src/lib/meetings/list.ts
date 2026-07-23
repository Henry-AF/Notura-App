import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, type RouteAuthContext } from "@/lib/api/auth";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export interface MeetingsListItem {
  id: string;
  title: string | null;
  client_name: string | null;
  group_id: string | null;
  group_name: string | null;
  status: string;
  created_at: string;
}

export interface MeetingsPageOptions {
  groupId?: string | null;
  limit?: number;
  cursor?: string | null;
}

export interface MeetingsPageResult {
  meetings: MeetingsListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function clampPageLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}

interface MeetingCursor {
  createdAt: string;
  id: string;
}

function encodeCursor(cursor: MeetingCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): MeetingCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    // invalid cursor — ignore and treat as no cursor
  }
  return null;
}

function buildMeetingPageQuery(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  options: MeetingsPageOptions
) {
  const limit = clampPageLimit(options.limit ?? DEFAULT_PAGE_LIMIT);
  const query = supabaseAdmin
    .from("meetings")
    .select("id, title, client_name, group_id, status, created_at, meeting_groups(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (options.groupId) {
    query.eq("group_id", options.groupId);
  }

  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }
  }

  return { query, limit };
}

type MeetingListRow = Pick<
  Database["public"]["Tables"]["meetings"]["Row"],
  "id" | "title" | "client_name" | "group_id" | "status" | "created_at"
> & {
  meeting_groups?: { name: string } | null;
};

function mapMeetingRow(meeting: MeetingListRow): MeetingsListItem {
  return {
    id: meeting.id,
    title: meeting.title,
    client_name: meeting.client_name,
    group_id: meeting.group_id ?? null,
    group_name: meeting.meeting_groups?.name ?? null,
    status: meeting.status,
    created_at: meeting.created_at,
  };
}

async function fetchMeetingsForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingsListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, title, client_name, group_id, status, created_at, meeting_groups(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar reuniões.");
  }

  return (data ?? []).map(mapMeetingRow);
}

async function fetchMeetingsPageForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  options: MeetingsPageOptions
): Promise<MeetingsPageResult> {
  const { query, limit } = buildMeetingPageQuery(supabaseAdmin, userId, options);
  const { data, error } = await query;

  if (error) {
    throw new Error("Erro ao carregar reuniões.");
  }

  const rows = (data ?? []).map(mapMeetingRow);
  const hasMore = rows.length > limit;
  const meetings = hasMore ? rows.slice(0, limit) : rows;
  const lastMeeting = meetings[meetings.length - 1];

  return {
    meetings,
    nextCursor:
      hasMore && lastMeeting
        ? encodeCursor({ createdAt: lastMeeting.created_at, id: lastMeeting.id })
        : null,
    hasMore,
  };
}


export async function getMeetingsForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingsListItem[]> {
  return fetchMeetingsForUser(supabaseAdmin, userId);
}

export async function getOwnedMeetingsForAuth(
  auth: RouteAuthContext
): Promise<MeetingsListItem[]> {
  return getMeetingsForUser(auth.supabaseAdmin, auth.user.id);
}

export async function getOwnedMeetingsPageForAuth(
  auth: RouteAuthContext,
  options: MeetingsPageOptions
): Promise<MeetingsPageResult> {
  return fetchMeetingsPageForUser(auth.supabaseAdmin, auth.user.id, options);
}

export async function getOwnedMeetings(): Promise<MeetingsListItem[]> {
  const auth = await requireAuth();
  return getOwnedMeetingsForAuth(auth);
}
