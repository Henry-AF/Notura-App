import { fetchMeetings } from "./meetings-api";
import type { MeetingsPageMeeting } from "./meetings-types";
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
