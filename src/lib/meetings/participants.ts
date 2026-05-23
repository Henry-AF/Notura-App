import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwnership } from "@/lib/api/auth";
import type {
  Database,
  MeetingParticipant,
  MeetingParticipantRole,
} from "@/types/database";
import type { GeminiMeetingParticipantDraft, ParticipantRefMap } from "./summary-structured";

type SupabaseAdminClient = SupabaseClient<Database>;
type MeetingParticipantInsert =
  Database["public"]["Tables"]["meeting_participants"]["Insert"];
type SupabaseQueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export interface UpdateMeetingParticipantInput {
  displayName?: unknown;
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
  const displayName = normalizeDisplayName(params.input.displayName);
  const result = await params.supabase
    .from("meeting_participants")
    .update({ display_name: displayName })
    .eq("id", params.participantId)
    .eq("meeting_id", params.meetingId)
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at")
    .single();

  return unwrapParticipantUpdateResult(result);
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
