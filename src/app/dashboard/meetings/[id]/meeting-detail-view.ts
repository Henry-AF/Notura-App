// View-state rules for the meeting detail route.
//
// A meeting that has not finished processing renders a dedicated processing
// view instead of the details view (NOT-57): the details-only chrome (tab bar,
// "Detalhes" breadcrumb) is suppressed, because none of the tabs have content
// to show yet and switching them has no effect.

import type { MeetingDetailData } from "./meeting-types";

type MeetingStatus = MeetingDetailData["meetingStatus"];

export function isProcessingView(status: MeetingStatus): boolean {
  return status === "processing" || status === "scheduled";
}

export function getMeetingBreadcrumbLabel(status: MeetingStatus): string {
  return isProcessingView(status) ? "Processando" : "Detalhes";
}
