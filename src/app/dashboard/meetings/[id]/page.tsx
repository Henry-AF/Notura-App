import { ToastProvider } from "@/components/upload/Toast";
import { fetchMeetingDetail } from "./meeting-api";
import type { MeetingDetailData } from "./meeting-types";
import { MeetingDetailClient } from "./meeting-detail-client";

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let initialMeeting: MeetingDetailData | null = null;

  try {
    initialMeeting = await fetchMeetingDetail(params.id);
  } catch {
    initialMeeting = null;
  }

  return (
    <ToastProvider>
      <MeetingDetailClient id={params.id} initialMeeting={initialMeeting} />
    </ToastProvider>
  );
}
