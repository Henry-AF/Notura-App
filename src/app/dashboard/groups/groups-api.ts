import {
  archiveMeetingGroup,
  assignMeetingToGroup,
  createMeetingGroup,
  deleteMeetingGroup,
  fetchMeetingGroupsSnapshot,
  updateMeetingGroup,
  type MeetingGroupClientItem,
  type MeetingGroupClientMeeting,
  type MeetingGroupsClientSnapshot,
} from "@/lib/meeting-groups-client";

export type GroupsPageGroup = MeetingGroupClientItem;
export type GroupsPageMeeting = MeetingGroupClientMeeting;

export interface GroupsPageData {
  groups: GroupsPageGroup[];
  meetings: GroupsPageMeeting[];
}

export function mapGroupsPageData(
  snapshot: MeetingGroupsClientSnapshot
): GroupsPageData {
  return {
    groups: snapshot.groups,
    meetings: snapshot.meetings,
  };
}

export async function fetchGroupsPageData(
  includeArchived = false
): Promise<GroupsPageData> {
  return mapGroupsPageData(await fetchMeetingGroupsSnapshot(includeArchived));
}

export async function createGroup(name: string): Promise<GroupsPageGroup> {
  return createMeetingGroup(name);
}

export async function renameGroup(
  groupId: string,
  name: string
): Promise<GroupsPageGroup> {
  return updateMeetingGroup(groupId, name);
}

export async function removeGroup(groupId: string): Promise<void> {
  await deleteMeetingGroup(groupId);
}

export async function archiveGroup(groupId: string): Promise<GroupsPageGroup> {
  return archiveMeetingGroup(groupId, true);
}

export async function unarchiveGroup(groupId: string): Promise<GroupsPageGroup> {
  return archiveMeetingGroup(groupId, false);
}

export async function moveMeetingToGroup(
  meetingId: string,
  groupId: string | null
): Promise<void> {
  await assignMeetingToGroup(meetingId, groupId);
}
