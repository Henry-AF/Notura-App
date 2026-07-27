// Server-side loader for the meeting detail page. The pure mapping lives in
// meeting-detail-mapper.ts so the client-side refetch can reuse it without
// pulling in server-only auth/Supabase modules.

import { getOwnedMeetingWithRelations } from "@/lib/meetings/detail";
import { mapMeetingDetail } from "./meeting-detail-mapper";
import type { MeetingDetailData } from "./meeting-types";

export { mapMeetingDetail } from "./meeting-detail-mapper";

export async function fetchMeetingDetail(id: string): Promise<MeetingDetailData> {
  const meeting = await getOwnedMeetingWithRelations(id);
  return mapMeetingDetail(meeting);
}
