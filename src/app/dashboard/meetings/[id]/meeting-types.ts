import type { MeetingFile, MeetingTask } from "@/components/meeting-detail";

export interface MeetingDetailData {
  clientName: string;
  meetingDate: string;
  meetingStatus: "completed" | "processing" | "failed" | "scheduled";
  participants: Array<{ name: string }>;
  summary: string;
  nextStep: string;
  keyDecision: string;
  alertPoint: string;
  transcript: string | null;
  location: string;
  tasks: MeetingTask[];
  files: MeetingFile[];
  insightMessage: string;
  decisions: Array<{
    id: string;
    description: string;
    decided_by: string | null;
    confidence: string;
  }>;
  openItems: Array<{
    id: string;
    description: string;
    context: string | null;
  }>;
}
