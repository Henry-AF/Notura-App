import { NextResponse } from "next/server";
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

export interface UpdateMeetingParticipantInput {
  displayName?: unknown;
}

export class MeetingParticipantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeetingParticipantValidationError";
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
  const { data, error } = await input.supabase
    .from("meeting_participants")
    .upsert(rowsToUpsert, { onConflict: "meeting_id,role,original_name" })
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at");

  if (error || !data) {
    throw new Error(`Failed to upsert meeting participants: ${error?.message}`);
  }

  return mapParticipantRefsToIds(input.participants, data);
}

export async function listMeetingParticipantsForUser(
  supabase: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingParticipant[]> {
  await requireOwnership(supabase, "meetings", meetingId, userId);

  const { data, error } = await supabase
    .from("meeting_participants")
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    throw new Error(`Failed to load meeting participants: ${error?.message}`);
  }

  return data;
}

export async function updateMeetingParticipantDisplayNameForUser(
  supabase: SupabaseAdminClient,
  userId: string,
  meetingId: string,
  participantId: string,
  input: UpdateMeetingParticipantInput
): Promise<MeetingParticipant> {
  await requireOwnership(supabase, "meetings", meetingId, userId);
  const displayName = normalizeDisplayName(input.displayName);
  const { data, error } = await supabase
    .from("meeting_participants")
    .update({ display_name: displayName })
    .eq("id", participantId)
    .eq("meeting_id", meetingId)
    .select("id, meeting_id, display_name, original_name, role, created_at, updated_at")
    .single();

  if (error || !data) {
    throw NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  return data;
}

function buildDraftSignature(draft: GeminiMeetingParticipantDraft): string {
  return `${draft.role}:${draft.originalName}`;
}

function buildSignature(row: { role: MeetingParticipantRole; original_name: string }) {
  return `${row.role}:${row.original_name}`;
}
