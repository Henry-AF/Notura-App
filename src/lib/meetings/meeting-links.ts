import { getAppBaseUrl } from "@/lib/app-url";

export function getMeetingDetailButtonParameter(meetingId: string): string {
  return encodeURIComponent(meetingId.trim());
}

export function getMeetingDetailPath(meetingId: string): string {
  return `dashboard/meetings/${getMeetingDetailButtonParameter(meetingId)}`;
}

export function getMeetingDetailUrl(
  meetingId: string,
  fallbackOrigin?: string
): string {
  const appBaseUrl = getAppBaseUrl(fallbackOrigin).replace(/\/+$/, "");
  return `${appBaseUrl}/${getMeetingDetailPath(meetingId)}`;
}
