import {
  getOwnedMeetingGroupsSnapshot,
  type MeetingGroupsSnapshot,
} from "@/lib/meeting-groups";
import type { GroupsPageData } from "./groups-api";
import { GroupsClient } from "./groups-client";

function getEmptyGroupsPageData(): GroupsPageData {
  return {
    groups: [],
    meetings: [],
  };
}

function mapGroupsSnapshot(snapshot: MeetingGroupsSnapshot): GroupsPageData {
  return {
    groups: snapshot.groups.map((group) => ({
      id: group.id,
      name: group.name,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      archivedAt: group.archived_at,
      meetingsCount: group.meetings_count,
    })),
    meetings: snapshot.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title ?? "Reuniao sem titulo",
      status: normalizeMeetingStatus(meeting.status),
      createdAt: meeting.created_at,
      groupId: meeting.group_id,
    })),
  };
}

function normalizeMeetingStatus(status: string): GroupsPageData["meetings"][number]["status"] {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "scheduled") return "scheduled";
  return "pending";
}

export default async function GroupsPage() {
  let initialData = getEmptyGroupsPageData();

  try {
    initialData = mapGroupsSnapshot(await getOwnedMeetingGroupsSnapshot(true));
  } catch {
    initialData = getEmptyGroupsPageData();
  }

  return <GroupsClient initialData={initialData} />;
}
