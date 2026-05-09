import { ToastProvider } from "@/components/upload/Toast";
import { fetchMeetingDetail } from "../meeting-api";
import { MobileChatClient } from "./mobile-chat-client";

export default async function MeetingMobileChatPage({
  params,
}: {
  params: { id: string };
}) {
  let meetingName = "Reunião";
  try {
    const meeting = await fetchMeetingDetail(params.id);
    if (meeting?.clientName) meetingName = meeting.clientName;
  } catch {
    // fall back to generic name
  }

  return (
    <ToastProvider>
      <MobileChatClient id={params.id} meetingName={meetingName} />
    </ToastProvider>
  );
}
