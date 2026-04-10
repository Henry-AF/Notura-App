import { ToastProvider } from "@/components/upload/Toast";
import { fetchMeetingEditData } from "./meeting-edit-api";
import type { MeetingEditData } from "./meeting-edit-types";
import { MeetingEditClient } from "./meeting-edit-client";

export default async function MeetingEditPage({
  params,
}: {
  params: { id: string };
}) {
  let initialMeeting: MeetingEditData | null = null;

  try {
    initialMeeting = await fetchMeetingEditData(params.id);
  } catch {
    initialMeeting = null;
  }

  return (
    <ToastProvider>
      <MeetingEditClient id={params.id} initialMeeting={initialMeeting} />
    </ToastProvider>
  );
}
