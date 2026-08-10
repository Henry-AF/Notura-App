import {
  cancelMeetingProcessing,
  fetchMeetingStatus,
  retryMeetingProcessing,
  type MeetingStatusPayload,
} from "@/lib/meetings/status";

export const PROCESSING_POLL_INTERVAL_MS = 4000;

export function getMeetingDetailRoute(meetingId: string): `/(app)/meetings/${string}` {
  return `/(app)/meetings/${meetingId}`;
}

export function fetchProcessingStatus(meetingId: string): Promise<MeetingStatusPayload> {
  return fetchMeetingStatus(meetingId);
}

export function retryProcessing(meetingId: string): Promise<void> {
  return retryMeetingProcessing(meetingId);
}

export function cancelProcessing(meetingId: string): Promise<void> {
  return cancelMeetingProcessing(meetingId);
}
