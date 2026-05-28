import { ToastProvider } from "@/components/upload/Toast";
import { fetchMeetingDetail } from "./meeting-api";
import type { MeetingDetailData } from "./meeting-types";
import { MeetingDetailClient } from "./meeting-detail-client";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialMeeting: MeetingDetailData | null = null;

  try {
    initialMeeting = await fetchMeetingDetail(id);
  } catch {
    initialMeeting = null;
  }

  return (
    <ToastProvider>
      <MeetingDetailClient id={id} initialMeeting={initialMeeting} />
    </ToastProvider>
  );
}
