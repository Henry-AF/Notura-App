import { fetchMeetings, type MeetingsPageMeeting } from "./meetings-api";
import { MeetingsClient } from "./meetings-client";

export default async function MeetingsPage() {
  let initialMeetings: MeetingsPageMeeting[] = [];

  try {
    initialMeetings = await fetchMeetings();
  } catch {
    initialMeetings = [];
  }

  return <MeetingsClient initialMeetings={initialMeetings} />;
}
