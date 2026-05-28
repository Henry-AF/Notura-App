import { ToastProvider } from "@/components/upload/Toast";
import { fetchMeetingEditData } from "./meeting-edit-api";
import type { MeetingEditData } from "./meeting-edit-types";
import { MeetingEditClient } from "./meeting-edit-client";

export default async function MeetingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialMeeting: MeetingEditData | null = null;

  try {
    initialMeeting = await fetchMeetingEditData(id);
  } catch {
    initialMeeting = null;
  }

  return (
    <ToastProvider>
      <MeetingEditClient id={id} initialMeeting={initialMeeting} />
    </ToastProvider>
  );
}
