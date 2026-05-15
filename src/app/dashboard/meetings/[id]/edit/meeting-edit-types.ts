export interface MeetingEditData {
  id: string;
  title: string;
  meetingDate: string;
  groupId: string | null;
  meetingGroups: Array<{ id: string; name: string }>;
}
