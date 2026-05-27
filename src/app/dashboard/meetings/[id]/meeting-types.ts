import type { MeetingFile, MeetingTask } from "@/components/meeting-detail";
import type { MeetingStructuredSummary } from "@/types/database";

export interface MeetingParticipantDisplay {
  id?: string;
  name: string;
  originalName?: string;
  role?: "participant" | "entity";
}

export interface MeetingDetailData {
  clientName: string;
  meetingDate: string;
  meetingStatus: "completed" | "processing" | "failed" | "scheduled";
  participants: MeetingParticipantDisplay[];
  entities: MeetingParticipantDisplay[];
  summary: string;
  summaryStructured: MeetingStructuredSummary | null;
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
