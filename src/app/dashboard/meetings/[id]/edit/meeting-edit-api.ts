import {
  getOwnedMeetingForEdit,
  type MeetingEditRecord,
} from "@/lib/meetings/edit";
import type { MeetingEditData } from "./meeting-edit-types";

function mapMeetingEditRecord(record: MeetingEditRecord): MeetingEditData {
  return {
    id: record.id,
    title: record.title ?? "",
    company: record.client_name ?? "",
    meetingDate: record.meeting_date ?? "",
  };
}

export async function fetchMeetingEditData(id: string): Promise<MeetingEditData> {
  const meeting = await getOwnedMeetingForEdit(id);
  return mapMeetingEditRecord(meeting);
}
