import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireOwnership,
  type RouteAuthContext,
} from "@/lib/api/auth";
import { validateMeetingDate } from "@/lib/meetings/meeting-date";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export interface MeetingEditRecord {
  id: string;
  title: string | null;
  client_name: string | null;
  meeting_date: string | null;
  created_at: string;
}

export interface MeetingEditInput {
  title?: string;
  clientName?: string;
  meetingDate?: string;
}

export class MeetingEditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeetingEditValidationError";
  }
}

function normalizeEditableText(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  if (!trimmed) {
    throw new MeetingEditValidationError(`${label} é obrigatório.`);
  }
  return trimmed;
}

function buildMeetingUpdatePayload(input: MeetingEditInput) {
  const title = normalizeEditableText(input.title, "Título");
  const clientName = normalizeEditableText(input.clientName, "Empresa");
  const meetingDate = input.meetingDate;

  if (meetingDate !== undefined) {
    if (!meetingDate.trim()) {
      throw new MeetingEditValidationError("Data da reunião é obrigatória.");
    }
    const meetingDateError = validateMeetingDate(meetingDate);
    if (meetingDateError) {
      throw new MeetingEditValidationError(meetingDateError);
    }
  }

  const payload = {
    ...(title !== undefined && { title }),
    ...(clientName !== undefined && { client_name: clientName }),
    ...(meetingDate !== undefined && { meeting_date: meetingDate }),
  };

  if (Object.keys(payload).length === 0) {
    throw new MeetingEditValidationError("Nenhum campo para atualizar.");
  }

  return payload;
}

async function selectMeetingForEdit(
  supabaseAdmin: SupabaseAdminClient,
  meetingId: string
): Promise<MeetingEditRecord> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, title, client_name, meeting_date, created_at")
    .eq("id", meetingId)
    .single();

  if (error || !data) {
    throw new Error("Erro ao carregar reunião.");
  }

  return data;
}

async function updateMeetingForEdit(
  supabaseAdmin: SupabaseAdminClient,
  meetingId: string,
  input: MeetingEditInput
): Promise<MeetingEditRecord> {
  const payload = buildMeetingUpdatePayload(input);
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .update(payload)
    .eq("id", meetingId)
    .select("id, title, client_name, meeting_date, created_at")
    .single();

  if (error || !data) {
    throw new Error("Erro ao atualizar reunião.");
  }

  return data;
}

export async function getMeetingForEditForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingEditRecord> {
  await requireOwnership(supabaseAdmin, "meetings", meetingId, userId);
  return selectMeetingForEdit(supabaseAdmin, meetingId);
}

export async function getOwnedMeetingForEditForAuth(
  auth: RouteAuthContext,
  meetingId: string
): Promise<MeetingEditRecord> {
  return getMeetingForEditForUser(auth.supabaseAdmin, auth.user.id, meetingId);
}

export async function getOwnedMeetingForEdit(
  meetingId: string
): Promise<MeetingEditRecord> {
  const auth = await requireAuth();
  return getOwnedMeetingForEditForAuth(auth, meetingId);
}

export async function updateMeetingForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  meetingId: string,
  input: MeetingEditInput
): Promise<MeetingEditRecord> {
  await requireOwnership(supabaseAdmin, "meetings", meetingId, userId);
  return updateMeetingForEdit(supabaseAdmin, meetingId, input);
}

export async function updateOwnedMeetingForAuth(
  auth: RouteAuthContext,
  meetingId: string,
  input: MeetingEditInput
): Promise<MeetingEditRecord> {
  return updateMeetingForUser(auth.supabaseAdmin, auth.user.id, meetingId, input);
}
