import {
  getOwnedMeetingForEdit,
  type MeetingEditRecord,
} from "@/lib/meetings/edit";
import { getOwnedMeetingGroupsSnapshot } from "@/lib/meeting-groups";
import type { MeetingEditData } from "./meeting-edit-types";

function mapMeetingEditRecord(
  record: MeetingEditRecord,
  groups: MeetingEditData["meetingGroups"]
): MeetingEditData {
  return {
    id: record.id,
    title: record.title ?? "",
    meetingDate: record.meeting_date ?? "",
    groupId: record.group_id,
    meetingGroups: groups,
  };
}

export async function fetchMeetingEditData(id: string): Promise<MeetingEditData> {
  const [meeting, snapshot] = await Promise.all([
    getOwnedMeetingForEdit(id),
    getOwnedMeetingGroupsSnapshot(),
  ]);

  return mapMeetingEditRecord(
    meeting,
    snapshot.groups.map((group) => ({ id: group.id, name: group.name }))
  );
}
