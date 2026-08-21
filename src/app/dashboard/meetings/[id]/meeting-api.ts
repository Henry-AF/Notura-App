// Server-side loader for the meeting detail page. The pure mapping lives in
// meeting-detail-mapper.ts so the client-side refetch can reuse it without
// pulling in server-only auth/Supabase modules.

import { getOwnedMeetingWithRelations } from "@/lib/meetings/detail";
import { ACTIVATION_EVENT, recordActivationEvent } from "@/lib/activation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { mapMeetingDetail } from "./meeting-detail-mapper";
import type { MeetingDetailData } from "./meeting-types";

export { mapMeetingDetail } from "./meeting-detail-mapper";

async function recordCompletedMeetingView(meeting: {
  id: string;
  user_id: string;
  status: string;
}): Promise<void> {
  if (meeting.status !== "completed") return;

  try {
    await recordActivationEvent({
      supabase: createServiceRoleClient(),
      userId: meeting.user_id,
      eventName: ACTIVATION_EVENT.minutesViewed,
      meetingId: meeting.id,
      channel: "in_app",
    });
  } catch (error) {
    console.error("[activation] Failed to record meeting view", error);
  }
}

export async function fetchMeetingDetail(id: string): Promise<MeetingDetailData> {
  const meeting = await getOwnedMeetingWithRelations(id);
  await recordCompletedMeetingView(meeting);
  return mapMeetingDetail(meeting);
}
