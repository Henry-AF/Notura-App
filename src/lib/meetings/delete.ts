import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireOwnership,
  type RouteAuthContext,
} from "@/lib/api/auth";
import { deleteAudio } from "@/lib/r2";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

interface MeetingDeleteRecord {
  id: string;
  audio_r2_key: string | null;
}

export interface MeetingDeleteResult {
  success: true;
  alreadyDeleted: boolean;
}

async function selectOwnedMeetingForDelete(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingDeleteRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("id, audio_r2_key")
    .eq("id", meetingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Erro ao carregar reunião para exclusão.");
  }

  return data;
}

async function deleteMeetingRow(
  supabaseAdmin: SupabaseAdminClient,
  meetingId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("meetings")
    .delete()
    .eq("id", meetingId);

  if (error) {
    throw new Error("Erro ao excluir reunião.");
  }
}

export async function deleteMeetingForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  meetingId: string
): Promise<MeetingDeleteResult> {
  try {
    await requireOwnership(supabaseAdmin, "meetings", meetingId, userId);
  } catch (error) {
    if (error instanceof Response && error.status === 403) {
      const ownedMeeting = await selectOwnedMeetingForDelete(
        supabaseAdmin,
        userId,
        meetingId
      );

      if (!ownedMeeting) {
        return { success: true, alreadyDeleted: true };
      }
    }

    throw error;
  }

  const meeting = await selectOwnedMeetingForDelete(supabaseAdmin, userId, meetingId);

  if (!meeting) {
    return { success: true, alreadyDeleted: true };
  }

  if (meeting.audio_r2_key) {
    await deleteAudio(meeting.audio_r2_key);
  }

  await deleteMeetingRow(supabaseAdmin, meetingId);

  return { success: true, alreadyDeleted: false };
}

export async function deleteOwnedMeetingForAuth(
  auth: RouteAuthContext,
  meetingId: string
): Promise<MeetingDeleteResult> {
  return deleteMeetingForUser(auth.supabaseAdmin, auth.user.id, meetingId);
}

export async function deleteOwnedMeeting(
  meetingId: string
): Promise<MeetingDeleteResult> {
  const auth = await requireAuth();
  return deleteOwnedMeetingForAuth(auth, meetingId);
}
