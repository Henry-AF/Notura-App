import { formatDate } from "@/lib/utils";
import { renderMeetingSummary } from "@/lib/meetings/summary-renderer";
import type {
  MeetingJSON,
  MeetingStructuredSummary,
  MeetingWithRelations,
} from "@/types/database";

export interface AtaParticipant {
  name: string;
}

export interface AtaTopic {
  title: string;
  content: string;
}

export interface AtaDecision {
  description: string;
  decided_by: string;
}

export interface AtaTask {
  description: string;
  owner: string;
  due_date: string;
}

export interface AtaData {
  meeting_title: string;
  meeting_date: string;
  participants: AtaParticipant[];
  objective: string;
  executive_summary: string;
  topics: AtaTopic[];
  decisions: AtaDecision[];
  tasks: AtaTask[];
  next_steps: string;
}

const UNASSIGNED_LABEL = "Não especificado";
const NO_DUE_DATE_LABEL = "Sem prazo definido";

export function buildAtaData(meeting: MeetingWithRelations): AtaData {
  const summaryJson = meeting.summary_json as MeetingJSON | null;
  const renderedSummary = renderMeetingSummary({
    summaryStructured: meeting.summary_structured as MeetingStructuredSummary | null,
    meetingParticipants: meeting.meeting_participants,
    summaryWhatsapp: meeting.summary_whatsapp,
    summaryJson,
  });

  return {
    meeting_title: meeting.title ?? meeting.client_name ?? "Reunião",
    meeting_date: formatDate(meeting.meeting_date ?? meeting.created_at),
    participants: renderedSummary.participants.map((participant) => ({
      name: participant.name,
    })),
    objective: summaryJson?.summary_one_line ?? "",
    executive_summary: renderedSummary.text,
    topics: renderedSummary.sections.map((section) => ({
      title: section.title,
      content: section.content,
    })),
    decisions: meeting.decisions.map((decision) => ({
      description: decision.description,
      decided_by: decision.decided_by ?? UNASSIGNED_LABEL,
    })),
    tasks: meeting.tasks.map((task) => ({
      description: task.description,
      owner: task.owner ?? UNASSIGNED_LABEL,
      due_date: task.due_date ? formatDate(task.due_date) : NO_DUE_DATE_LABEL,
    })),
    // `open_items` is the existing "pending / follow-up" table for a meeting
    // (see src/lib/meetings/detail.ts and getNextStep in meeting-api.ts), so
    // it is the closest real column to the "next steps" section of the ATA.
    next_steps: meeting.open_items.map((item) => item.description).join("; "),
  };
}

const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

export function buildAtaFilename(meeting: MeetingWithRelations): string {
  const source = meeting.title ?? meeting.client_name ?? meeting.id;
  const slug = source
    .normalize("NFD")
    .replace(COMBINING_DIACRITICAL_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `ata-${slug || meeting.id}.docx`;
}
