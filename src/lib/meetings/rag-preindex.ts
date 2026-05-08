import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest";
import {
  ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
  ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
  TRANSCRIPT_CHUNKING_VERSION,
} from "@/lib/meetings/rag";
import { createTraceId, getErrorMessage, logStructured } from "@/lib/observability";
import type { Database } from "@/types/database";

export const MEETING_RAG_INDEX_EVENT_NAME = "meeting/rag.index";

type SupabaseAdminClient = SupabaseClient<Database>;
type MeetingRagPreindexResult =
  | "skipped"
  | "already_indexed"
  | "dispatched"
  | "failed";

interface MeetingRagPreindexCandidate {
  id: string;
  status: string | null;
  transcript: string | null;
}

interface PrewarmMeetingRagIndexInput {
  supabase: SupabaseAdminClient;
  meeting: MeetingRagPreindexCandidate;
  userId: string;
  route: string;
  requestId?: string;
  startedAt?: number;
}

async function hasActiveMeetingRagIndex(
  supabase: SupabaseAdminClient,
  meetingId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("meeting_transcript_chunks")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("embedding_model", ACTIVE_TRANSCRIPT_EMBEDDING_MODEL)
    .eq("embedding_dimensions", ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS)
    .eq("chunking_version", TRANSCRIPT_CHUNKING_VERSION)
    .limit(1);

  if (error) throw error;
  return (data ?? []).length > 0;
}

function shouldPrewarmMeetingRagIndex(
  meeting: MeetingRagPreindexCandidate
): boolean {
  return meeting.status === "completed" && Boolean(meeting.transcript);
}

export async function prewarmMeetingRagIndex({
  supabase,
  meeting,
  userId,
  route,
  requestId = createTraceId(),
  startedAt = Date.now(),
}: PrewarmMeetingRagIndexInput): Promise<MeetingRagPreindexResult> {
  if (!shouldPrewarmMeetingRagIndex(meeting)) return "skipped";

  try {
    const alreadyIndexed = await hasActiveMeetingRagIndex(supabase, meeting.id);
    if (alreadyIndexed) return "already_indexed";

    await inngest.send({
      name: MEETING_RAG_INDEX_EVENT_NAME,
      data: {
        meetingId: meeting.id,
        userId,
      },
    });
    return "dispatched";
  } catch (error) {
    logStructured("warn", {
      event: "meeting.rag.preindex.dispatch_failed",
      requestId,
      userId,
      route,
      durationMs: Date.now() - startedAt,
      status: 202,
      errorMessage: getErrorMessage(error),
      extra: {
        meetingId: meeting.id,
      },
    });
    return "failed";
  }
}
