export type MeetingsPageStatus = "completed" | "processing" | "failed";

export interface MeetingsPageMeeting {
  id: string;
  clientName: string;
  title: string;
  date: string;
  rawDate: string;
  status: MeetingsPageStatus;
}
