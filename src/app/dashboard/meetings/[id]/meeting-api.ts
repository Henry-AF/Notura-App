import type { MeetingFile, MeetingTask } from "@/components/meeting-detail";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { getOwnedMeetingWithRelations } from "@/lib/meetings/detail";
import type { MeetingJSON, MeetingWithRelations } from "@/types/database";

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
  const summaryJson = (meeting.summary_json as MeetingJSON | null) ?? null;
  const participants =
    summaryJson?.meeting?.participants?.map((name) => ({ name })) ?? [];
  const tasks: MeetingTask[] = (meeting.tasks ?? []).map((task) => {
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
  const decisions = (meeting.decisions ?? []).map((decision) => ({
    id: decision.id,
    description: decision.description,
    decided_by: decision.decided_by,
    confidence: decision.confidence,
  }));
  const openItems = (meeting.open_items ?? []).map((item) => ({
    id: item.id,
    description: item.description,
    context: item.context,
  }));
  const files: MeetingFile[] = meeting.audio_r2_key
    ? [
        {
          id: "audio",
          name: meeting.audio_r2_key.split("/").pop() ?? "audio.m4a",
          size: "—",
          type: "other",
          url: "#",
        },
      ]
    : [];
  const pendingCount = tasks.filter((task) => !task.completed).length;

  return {
    clientName: meeting.client_name ?? meeting.title ?? "—",
    meetingDate: formatRelativeTime(meeting.meeting_date ?? meeting.created_at),
    meetingStatus: normalizeMeetingStatus(meeting.status),
    participants,
    summary: meeting.summary_whatsapp ?? "",
    nextStep:
      openItems[0]?.description ??
      tasks.find((task) => !task.completed)?.text ??
      "",
    keyDecision: decisions[0]?.description ?? "",
    alertPoint: openItems[0]?.description ?? "",
    transcript: meeting.transcript,
    location: summaryJson?.next_meeting?.location_or_link ?? "Reunião Online",
    tasks,
    files,
    insightMessage:
      pendingCount > 0
        ? `Você tem ${pendingCount} tarefa${
            pendingCount > 1 ? "s" : ""
          } pendente${pendingCount > 1 ? "s" : ""} desta reunião.`
        : "Todas as tarefas desta reunião foram concluídas. 🎉",
    decisions,
    openItems,
  };
}

export async function fetchMeetingDetail(id: string): Promise<MeetingDetailData> {
  const meeting = await getOwnedMeetingWithRelations(id);
  return mapMeetingDetail(meeting);
}
