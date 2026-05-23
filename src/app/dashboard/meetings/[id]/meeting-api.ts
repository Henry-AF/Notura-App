import type { MeetingTask } from "@/components/meeting-detail";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { getOwnedMeetingWithRelations } from "@/lib/meetings/detail";
import { renderMeetingSummary } from "@/lib/meetings/summary-renderer";
import type {
  MeetingJSON,
  MeetingStructuredSummary,
  MeetingWithRelations,
} from "@/types/database";
import type { MeetingDetailData } from "./meeting-types";

function normalizeMeetingStatus(
  status: string | null | undefined
): MeetingDetailData["meetingStatus"] {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

function normalizeTaskPriority(priority: string): MeetingTask["priority"] {
  const normalized = priority.toLowerCase().replace("é", "e");

  if (normalized === "alta") return "Alta";
  if (normalized === "media" || normalized === "média") return "Média";
  return "Baixa";
}

function normalizeTaskStatus(
  status: string | null | undefined,
  completed: boolean
): "todo" | "in_progress" | "completed" {
  if (status === "in_progress") return "in_progress";
  if (status === "completed" || status === "done") return "completed";
  return completed ? "completed" : "todo";
}

export function mapMeetingDetail(
  meeting: MeetingWithRelations
): MeetingDetailData {
  const summaryJson = meeting.summary_json as MeetingJSON | null;
  const renderedSummary = renderMeetingSummaryForMeeting(meeting, summaryJson);
  const tasks = mapTasks(meeting.tasks);
  const decisions = meeting.decisions.map((decision) => ({
    id: decision.id,
    description: decision.description,
    decided_by: decision.decided_by,
    confidence: decision.confidence,
  }));
  const openItems = meeting.open_items.map((item) => ({
    id: item.id,
    description: item.description,
    context: item.context,
  }));
  const pendingCount = tasks.filter((task) => !task.completed).length;

  return {
    clientName: meeting.client_name ?? meeting.title ?? "—",
    meetingDate: formatRelativeTime(meeting.meeting_date ?? meeting.created_at),
    meetingStatus: normalizeMeetingStatus(meeting.status),
    participants: renderedSummary.participants,
    entities: renderedSummary.entities,
    summary: renderedSummary.text,
    nextStep: getNextStep(openItems, tasks),
    keyDecision: getFirst(decisions)?.description ?? "",
    alertPoint: getFirst(openItems)?.description ?? "",
    transcript: meeting.transcript,
    location: summaryJson?.next_meeting?.location_or_link ?? "Reunião Online",
    tasks,
    files: buildFiles(meeting.audio_r2_key),
    insightMessage: buildInsightMessage(pendingCount),
    decisions,
    openItems,
  };
}

function renderMeetingSummaryForMeeting(
  meeting: MeetingWithRelations,
  summaryJson: MeetingJSON | null
) {
  return renderMeetingSummary({
    summaryStructured: meeting.summary_structured as MeetingStructuredSummary | null,
    meetingParticipants: meeting.meeting_participants,
    summaryWhatsapp: meeting.summary_whatsapp,
    summaryJson,
  });
}

function mapTasks(tasks: MeetingWithRelations["tasks"]): MeetingTask[] {
  return tasks.map((task) => {
    const status = normalizeTaskStatus(task.status, task.completed);
    const completed = status === "completed";

    return {
      id: task.id,
      text: task.description,
      completed,
      status,
      assignee: task.owner ?? undefined,
      priority: normalizeTaskPriority(task.priority),
      dueDate: task.due_date ? formatDate(task.due_date) : undefined,
      completedLabel:
        completed && task.completed_at
          ? `Concluído em ${formatDate(task.completed_at)}`
          : undefined,
    };
  });
}

function buildFiles(audioR2Key: string | null): MeetingDetailData["files"] {
  return audioR2Key
    ? [
        {
          id: "audio",
          name: audioR2Key.split("/").pop() ?? "audio.m4a",
          size: "—",
          type: "other",
          url: "#",
        },
      ]
    : [];
}

function getFirst<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[0] : undefined;
}

function getNextStep(
  openItems: MeetingDetailData["openItems"],
  tasks: MeetingTask[]
): string {
  return getFirst(openItems)?.description ?? tasks.find((task) => !task.completed)?.text ?? "";
}

function buildInsightMessage(pendingCount: number): string {
  if (pendingCount === 0) {
    return "Todas as tarefas desta reunião foram concluídas. 🎉";
  }

  return `Você tem ${pendingCount} tarefa${
    pendingCount > 1 ? "s" : ""
  } pendente${pendingCount > 1 ? "s" : ""} desta reunião.`;
}

export async function fetchMeetingDetail(id: string): Promise<MeetingDetailData> {
  const meeting = await getOwnedMeetingWithRelations(id);
  return mapMeetingDetail(meeting);
}
