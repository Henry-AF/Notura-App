import { requireAuth } from "@/lib/api/auth";
import {
  getMeetingGroupDashboardForAuth,
  getOwnedMeetingGroupsSnapshotForAuth,
} from "@/lib/meeting-groups";
import { mapGroupDashboard } from "./group-dashboard-api";
import { GroupDashboardClient } from "./group-dashboard-client";

async function loadGroupDashboardPageData(groupId: string) {
  const auth = await requireAuth();
  const [rawDashboard, snapshot] = await Promise.all([
    getMeetingGroupDashboardForAuth(auth, groupId),
    getOwnedMeetingGroupsSnapshotForAuth(auth, true),
  ]);

  return {
    dashboard: mapGroupDashboard(rawDashboard),
    groupName: snapshot.groups.find((group) => group.id === groupId)?.name ?? "Grupo",
  };
}

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const { dashboard, groupName } = await loadGroupDashboardPageData(id);

    return (
      <GroupDashboardClient
        groupId={id}
        groupName={groupName}
        initialDashboard={dashboard}
      />
    );
  } catch {
    // `getMeetingGroupDashboardForAuth` throws a 403 Response via `requireOwnership`
    // for both a missing group and a group owned by another user. Any other failure
    // here is a genuine bug. Either way we must not fabricate a plausible-looking
    // empty dashboard for a group we couldn't actually verify — render the
    // not-found state instead (same pattern as meetings/[id]).
    return (
      <GroupDashboardClient groupId={id} groupName={null} initialDashboard={null} />
    );
  }
}
