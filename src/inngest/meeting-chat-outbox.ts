import { inngest } from "@/lib/inngest";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import type { Database, Json } from "@/types/database";

const OUTBOX_BATCH_LIMIT = 10;
const DEAD_AFTER_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60_000;

type SupabaseAdminClient = ReturnType<typeof createServiceRoleClient>;
type MeetingChatOutboxRow =
  Database["public"]["Tables"]["meeting_chat_outbox"]["Row"];

function resolveInngestRequestId(eventId: unknown): string {
  if (typeof eventId !== "string") return createTraceId();
  const trimmed = eventId.trim();
  return trimmed.length > 0 ? trimmed : createTraceId();
}

function asEventPayload(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Meeting chat outbox payload must be a JSON object");
  }

  return value as Record<string, unknown>;
}

async function fetchPendingOutboxRows(
  supabase: SupabaseAdminClient
): Promise<MeetingChatOutboxRow[]> {
  const { data, error } = await supabase
    .from("meeting_chat_outbox")
    .select("*")
    .in("status", ["pending", "processing"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(OUTBOX_BATCH_LIMIT);

  if (error) throw new Error(`Failed to fetch meeting chat outbox: ${error.message}`);
  return data ?? [];
}

async function claimOutboxRow(
  supabase: SupabaseAdminClient,
  row: MeetingChatOutboxRow
): Promise<MeetingChatOutboxRow | null> {
  const now = new Date().toISOString();
  const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
  const { data, error } = await supabase
    .from("meeting_chat_outbox")
    .update({
      status: "processing",
      attempts: row.attempts + 1,
      last_attempt_at: now,
      next_attempt_at: nextAttemptAt,
      updated_at: now,
    })
    .eq("id", row.id)
    .in("status", ["pending", "processing"])
    .lte("next_attempt_at", now)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Failed to claim meeting chat outbox: ${error.message}`);
  return data;
}

async function markOutboxSent(
  supabase: SupabaseAdminClient,
  rowId: string
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
    .eq("id", rowId);

  if (error) throw new Error(`Failed to mark meeting chat outbox sent: ${error.message}`);
}

async function markOutboxFailedAttempt(
  supabase: SupabaseAdminClient,
  row: MeetingChatOutboxRow,
  message: string
): Promise<"pending" | "dead"> {
  const now = new Date();
  const isDead = row.attempts > DEAD_AFTER_ATTEMPTS;
  const status = isDead ? "dead" : "pending";
  const { error } = await supabase
    .from("meeting_chat_outbox")
    .update({
      status,
      last_error: message,
      next_attempt_at: new Date(now.getTime() + RETRY_DELAY_MS).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", row.id);

  if (error) throw new Error(`Failed to mark meeting chat outbox failed: ${error.message}`);
  return status;
}

async function dispatchOutboxRow(
  supabase: SupabaseAdminClient,
  row: MeetingChatOutboxRow,
  requestId: string
): Promise<"sent" | "pending" | "dead" | "skipped"> {
  const startedAt = Date.now();
  const claimed = await claimOutboxRow(supabase, row);
  if (!claimed) return "skipped";

  try {
    await inngest.send({
      name: claimed.event_name,
      data: asEventPayload(claimed.payload),
    });
    await markOutboxSent(supabase, claimed.id);
    return "sent";
  } catch (error) {
    const message = getErrorMessage(error);
    const status = await markOutboxFailedAttempt(supabase, claimed, message);

    if (status === "dead") {
      captureObservedError(error, {
        event: "meeting.chat.outbox.dead",
        requestId,
        userId: claimed.user_id,
        route: "inngest/meeting-chat-outbox",
        durationMs: Date.now() - startedAt,
        status: 500,
        extra: {
          outboxId: claimed.id,
          chatId: claimed.chat_id,
          attempts: claimed.attempts,
        },
      });
    }

    return status;
  }
}

export const dispatchMeetingChatOutbox = inngest.createFunction(
  {
    id: "dispatch-meeting-chat-outbox",
    retries: 0,
    triggers: [
      { event: "meeting/chat.outbox.dispatch" },
      { cron: "*/1 * * * *" },
    ],
  },
  async ({ event, step }) => {
    const startedAt = Date.now();
    const requestId = resolveInngestRequestId((event as { id?: unknown }).id);
    const supabase = createServiceRoleClient();

    const rows = await step.run("fetch-pending-outbox", () =>
      fetchPendingOutboxRows(supabase)
    );

    const results = {
      sent: 0,
      pending: 0,
      dead: 0,
      skipped: 0,
    };

    for (const row of rows) {
      const result = await step.run(`dispatch-outbox-${row.id}`, () =>
        dispatchOutboxRow(supabase, row, requestId)
      );
      results[result] += 1;
    }

    logStructured("info", {
      event: "inngest.job.completed",
      requestId,
      route: "inngest/meeting-chat-outbox",
      durationMs: Date.now() - startedAt,
      status: 200,
      extra: results,
    });

    return results;
  }
);
