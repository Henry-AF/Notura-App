import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwnership } from "@/lib/api/auth";
import type {
  Database,
  Json,
  MeetingParticipant,
  MeetingParticipantRole,
} from "@/types/database";
import type { GeminiMeetingParticipantDraft, ParticipantRefMap } from "./summary-structured";

type SupabaseAdminClient = SupabaseClient<Database>;
type MeetingParticipantInsert =
  Database["public"]["Tables"]["meeting_participants"]["Insert"];
type MeetingParticipantUpdate =
  Database["public"]["Tables"]["meeting_participants"]["Update"];
type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export interface UpdateMeetingParticipantInput {
  displayName?: unknown;
  role?: unknown;
}

export interface UpdateMeetingParticipantDisplayNameForUserInput {
  supabase: SupabaseAdminClient;
  userId: string;
  meetingId: string;
  participantId: string;
  input: UpdateMeetingParticipantInput;
}

export class MeetingParticipantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeetingParticipantValidationError";
  }
}

export class MeetingParticipantAccessError extends Error {
  constructor() {
    super("Acesso negado.");
    this.name = "MeetingParticipantAccessError";
  }
}

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new MeetingParticipantValidationError("Nome é obrigatório.");
  }

  const displayName = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!displayName) {
    throw new MeetingParticipantValidationError("Nome é obrigatório.");
  }

  if (displayName.length > 80) {
    throw new MeetingParticipantValidationError(
      "Nome deve ter no máximo 80 caracteres."
    );
  }

  return displayName;
}

export function normalizeParticipantRole(value: unknown): MeetingParticipantRole {
  if (value === "participant" || value === "entity") {
    return value;
  }

  throw new MeetingParticipantValidationError(
    "Tipo deve ser participante ou entidade."
  );
}

export function buildParticipantUpserts(input: {
  meetingId: string;
  participants: GeminiMeetingParticipantDraft[];
}): MeetingParticipantInsert[] {
  return input.participants.map((participant) => ({
    meeting_id: input.meetingId,
    display_name: normalizeDisplayName(participant.displayName),
    original_name: participant.originalName,
    role: participant.role,
  }));
}

export function mapParticipantRefsToIds(
  drafts: GeminiMeetingParticipantDraft[],
  rows: MeetingParticipant[]
): ParticipantRefMap {
  const rowBySignature = new Map(rows.map((row) => [buildSignature(row), row]));

  return Object.fromEntries(
    drafts.map((draft) => {
      const row = rowBySignature.get(buildDraftSignature(draft));
      if (!row) {
        throw new Error("Failed to persist meeting participant refs");
      }

      return [draft.ref, { id: row.id, role: row.role }];
    })
  );
}

export async function upsertMeetingParticipants(input: {
  supabase: SupabaseAdminClient;
  meetingId: string;
  participants: GeminiMeetingParticipantDraft[];
}): Promise<ParticipantRefMap> {
  const rowsToUpsert = buildParticipantUpserts(input);
  const result = await input.supabase
    .from("meeting_participants")
    .upsert(rowsToUpsert, { onConflict: "meeting_id,role,original_name" })
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at");

  const data = unwrapSupabaseData<MeetingParticipant[]>(
    result,
    "Failed to upsert meeting participants"
  );

  return mapParticipantRefsToIds(input.participants, data);
}

export async function listMeetingParticipantsForUser(
  supabase: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingParticipant[]> {
  await requireOwnership(supabase, "meetings", meetingId, userId);

  const result = await supabase
    .from("meeting_participants")
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  return unwrapSupabaseData<MeetingParticipant[]>(
    result,
    "Failed to load meeting participants"
  );
}

export async function updateMeetingParticipantDisplayNameForUser(
  params: UpdateMeetingParticipantDisplayNameForUserInput
): Promise<MeetingParticipant> {
  await requireOwnership(
    params.supabase,
    "meetings",
    params.meetingId,
    params.userId
  );
  const updatePayload: MeetingParticipantUpdate = {};
  if (params.input.displayName !== undefined) {
    updatePayload.display_name = normalizeDisplayName(params.input.displayName);
  }
  if (params.input.role !== undefined) {
    updatePayload.role = normalizeParticipantRole(params.input.role);
  }
  if (!updatePayload.display_name && !updatePayload.role) {
    throw new MeetingParticipantValidationError("Nenhuma alteração informada.");
  }

  const result = await params.supabase
    .from("meeting_participants")
    .update(updatePayload)
    .eq("id", params.participantId)
    .eq("meeting_id", params.meetingId)
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at")
    .single();

  const participant = unwrapParticipantUpdateResult(result);
  if (participant.role === "entity") {
    await clearStructuredActionItemOwnership(params.supabase, {
      meetingId: params.meetingId,
      participantId: participant.id,
    });
  }

  return participant;
}

async function clearStructuredActionItemOwnership(
  supabase: SupabaseAdminClient,
  params: { meetingId: string; participantId: string }
): Promise<void> {
  const result = await supabase
    .from("meetings")
    .select("summary_structured")
    .eq("id", params.meetingId)
    .maybeSingle();

  if (
    result.error ||
    !isStructuredSummaryWithActionItems(result.data?.summary_structured)
  ) {
    return;
  }

  const summaryStructured = result.data.summary_structured as Record<string, unknown> & {
    action_items: Array<Record<string, unknown> & { participant_id?: unknown }>;
  };
  const actionItems = summaryStructured.action_items.map((item) =>
    item.participant_id === params.participantId
      ? { ...item, participant_id: null }
      : item
  );

  await supabase
    .from("meetings")
    .update({
      summary_structured: {
        ...summaryStructured,
        action_items: actionItems,
      } as unknown as Json,
    })
    .eq("id", params.meetingId);
}

function isStructuredSummaryWithActionItems(value: unknown): value is {
  [key: string]: unknown;
  action_items: Array<Record<string, unknown> & { participant_id?: unknown }>;
} {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Array.isArray((value as { action_items?: unknown }).action_items)
  );
}

function unwrapSupabaseData<T>(
  result: SupabaseQueryResult<T>,
  operation: string
): T {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }

  if (result.data === null) {
    throw new Error(`${operation}: missing data`);
  }

  return result.data;
}

function unwrapParticipantUpdateResult(
  result: SupabaseQueryResult<MeetingParticipant>
): MeetingParticipant {
  if (result.error || result.data === null) {
    throw new MeetingParticipantAccessError();
  }

  return result.data;
}

function buildDraftSignature(draft: GeminiMeetingParticipantDraft): string {
  return `${draft.role}:${draft.originalName}`;
}

function buildSignature(row: { role: MeetingParticipantRole; original_name: string }) {
  return `${row.role}:${row.original_name}`;
}
