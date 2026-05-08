import { inngest } from "@/lib/inngest";
import { generateEmbedding } from "@/lib/gemini";
import { MEETING_RAG_INDEX_EVENT_NAME } from "@/lib/meetings/rag-preindex";
import { ensureMeetingChunksIndexed } from "@/lib/meetings/rag";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

interface MeetingRagIndexEventData {
  meetingId: string;
  userId: string;
}

type SupabaseAdminClient = ReturnType<typeof createServiceRoleClient>;
type MeetingRow = Pick<
  Database["public"]["Tables"]["meetings"]["Row"],
  "id" | "user_id" | "status" | "transcript"
>;
type StepRunner = {
  run(name: string, fn: () => Promise<unknown> | unknown): Promise<unknown>;
};

interface RunMeetingRagPreindexInput {
  supabase: SupabaseAdminClient;
  step: StepRunner;
  data: MeetingRagIndexEventData;
  requestId: string;
  startedAt: number;
}

function resolveInngestRequestId(eventId: unknown): string {
  if (typeof eventId !== "string") return createTraceId();
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : createTraceId();
}

function readRequiredString(
  payload: Record<string, unknown>,
  field: keyof MeetingRagIndexEventData
): string {
  const value = payload[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid meeting/rag.index payload: ${field} is required`);
  }
  return value.trim();
}

function parseMeetingRagIndexEventData(payload: unknown): MeetingRagIndexEventData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid meeting/rag.index payload");
  }

  const record = payload as Record<string, unknown>;
  return {
    meetingId: readRequiredString(record, "meetingId"),
    userId: readRequiredString(record, "userId"),
  };
}

async function loadMeetingForRagPreindex(
  supabase: SupabaseAdminClient,
  data: MeetingRagIndexEventData
): Promise<MeetingRow> {
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("id, user_id, status, transcript")
    .eq("id", data.meetingId)
    .single();

  if (error || !meeting || meeting.user_id !== data.userId) {
    throw new Error("Meeting not found for RAG preindex");
  }

  return meeting;
}

function buildSkippedResult(meeting: MeetingRow) {
  return {
    meetingId: meeting.id,
    status: "skipped",
    reason: "meeting_not_ready",
  };
}

function logPreindexCompleted({
  requestId,
  userId,
  startedAt,
  meetingId,
  chunks,
}: {
  requestId: string;
  userId: string;
  startedAt: number;
  meetingId: string;
  chunks: number;
}): void {
  logStructured("info", {
    event: "meeting.rag.preindex.completed",
    requestId,
    userId,
    route: "inngest/preindex-meeting-rag",
    durationMs: Date.now() - startedAt,
    status: "completed",
    extra: {
      meetingId,
      chunks,
    },
  });
}

function capturePreindexFailure(
  error: unknown,
  input: Omit<RunMeetingRagPreindexInput, "supabase" | "step">
): void {
  logStructured("error", {
    event: "meeting.rag.preindex.failed",
    requestId: input.requestId,
    userId: input.data.userId,
    route: "inngest/preindex-meeting-rag",
    durationMs: Date.now() - input.startedAt,
    status: "failed",
    errorMessage: getErrorMessage(error),
  });

  captureObservedError(error, {
    event: "meeting.rag.preindex.failed",
    requestId: input.requestId,
    userId: input.data.userId,
    route: "inngest/preindex-meeting-rag",
    durationMs: Date.now() - input.startedAt,
    status: "failed",
    extra: {
      meetingId: input.data.meetingId,
    },
  });
}

async function runMeetingRagPreindex({
  supabase,
  step,
  data,
  requestId,
  startedAt,
}: RunMeetingRagPreindexInput) {
  const meeting = (await step.run("load-meeting", () =>
    loadMeetingForRagPreindex(supabase, data)
  )) as MeetingRow;

  if (meeting.status !== "completed" || !meeting.transcript) {
    return buildSkippedResult(meeting);
  }

  const chunks = (await step.run("ensure-rag-index", () =>
    ensureMeetingChunksIndexed({
      supabase,
      meeting,
      embedText: generateEmbedding,
    })
  )) as Awaited<ReturnType<typeof ensureMeetingChunksIndexed>>;

  logPreindexCompleted({
    requestId,
    userId: data.userId,
    startedAt,
    meetingId: meeting.id,
    chunks: chunks.length,
  });

  return { meetingId: meeting.id, status: "indexed", chunks: chunks.length };
}

export const preindexMeetingRag = inngest.createFunction(
  {
    id: "preindex-meeting-rag",
    retries: 1,
    triggers: [{ event: MEETING_RAG_INDEX_EVENT_NAME }],
  },
  async ({ event, step }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    const data = parseMeetingRagIndexEventData(event.data);
    const supabase = createServiceRoleClient();

    try {
      return await runMeetingRagPreindex({
        supabase,
        step,
        data,
        requestId,
        startedAt,
      });
    } catch (error) {
      capturePreindexFailure(error, { data, requestId, startedAt });
      throw error;
    }
  }
);
