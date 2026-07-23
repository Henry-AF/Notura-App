import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export type MeetingDetailStatus = "pending" | "processing" | "completed" | "failed";

export interface MeetingDetailParticipant {
  id?: string;
  name: string;
  originalName?: string;
  role?: "participant" | "entity";
}

export interface MeetingDetailTask {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
}

export interface MeetingDetailDecision {
  id: string;
  description: string;
  decidedBy: string | null;
}

export interface MeetingDetailOpenItem {
  id: string;
  description: string;
  context: string | null;
}

export interface MeetingDetail {
  id: string;
  clientName: string;
  meetingDate: string;
  status: MeetingDetailStatus;
  participants: MeetingDetailParticipant[];
  entities: MeetingDetailParticipant[];
  summary: string;
  transcript: string | null;
  tasks: MeetingDetailTask[];
  decisions: MeetingDetailDecision[];
  openItems: MeetingDetailOpenItem[];
}

interface MeetingDetailApiResponse {
  id?: string;
  client_name?: string | null;
  title?: string | null;
  meeting_date?: string | null;
  created_at?: string;
  status?: string;
  meeting_participants?: {
    id?: string;
    display_name?: string;
    original_name?: string;
    role?: string;
  }[];
  summary_whatsapp?: string | null;
  summary_json?: Record<string, unknown> | null;
  transcript?: string | null;
  tasks?: {
    id: string;
    description: string;
    completed: boolean;
    owner?: string | null;
    due_date?: string | null;
  }[];
  decisions?: {
    id: string;
    description: string;
    decided_by?: string | null;
  }[];
  open_items?: {
    id: string;
    description: string;
    context?: string | null;
  }[];
  error?: string;
}

function normalizeMeetingDetailStatus(status: string): MeetingDetailStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "pending") return "pending";
  return "processing";
}

function pickParticipants(
  participants: MeetingDetailApiResponse["meeting_participants"]
): MeetingDetailParticipant[] {
  return (participants ?? []).map((participant) => ({
    id: participant.id,
    name: participant.display_name ?? participant.original_name ?? "—",
    originalName: participant.original_name,
    role: participant.role === "entity" ? "entity" : "participant",
  }));
}

function pickEntities(participants: MeetingDetailParticipant[]): MeetingDetailParticipant[] {
  return participants.filter((participant) => participant.role === "entity");
}

function pickPeople(participants: MeetingDetailParticipant[]): MeetingDetailParticipant[] {
  return participants.filter((participant) => participant.role !== "entity");
}

function extractSummary(response: MeetingDetailApiResponse): string {
  if (typeof response.summary_whatsapp === "string" && response.summary_whatsapp.trim()) {
    return response.summary_whatsapp;
  }

  const summaryJson = response.summary_json;
  if (summaryJson && typeof summaryJson.summary === "string") {
    return summaryJson.summary;
  }

  return "Resumo não disponível.";
}

function mapTasks(tasks: MeetingDetailApiResponse["tasks"]): MeetingDetailTask[] {
  return (tasks ?? []).map((task) => ({
    id: task.id,
    text: task.description,
    completed: task.completed,
    assignee: task.owner ?? undefined,
    dueDate: task.due_date ?? undefined,
  }));
}

function mapDecisions(
  decisions: MeetingDetailApiResponse["decisions"]
): MeetingDetailDecision[] {
  return (decisions ?? []).map((decision) => ({
    id: decision.id,
    description: decision.description,
    decidedBy: decision.decided_by ?? null,
  }));
}

function mapOpenItems(
  openItems: MeetingDetailApiResponse["open_items"]
): MeetingDetailOpenItem[] {
  return (openItems ?? []).map((item) => ({
    id: item.id,
    description: item.description,
    context: item.context ?? null,
  }));
}

export function mapMeetingDetail(
  response: MeetingDetailApiResponse,
  meetingId: string
): MeetingDetail {
  const allParticipants = pickParticipants(response.meeting_participants);
  const meetingDate = response.meeting_date ?? response.created_at ?? "";

  return {
    id: response.id ?? meetingId,
    clientName: response.client_name ?? response.title ?? "—",
    meetingDate,
    status: normalizeMeetingDetailStatus(response.status ?? "processing"),
    participants: pickPeople(allParticipants),
    entities: pickEntities(allParticipants),
    summary: extractSummary(response),
    transcript: response.transcript ?? null,
    tasks: mapTasks(response.tasks),
    decisions: mapDecisions(response.decisions),
    openItems: mapOpenItems(response.open_items),
  };
}

export async function fetchMeetingDetail(meetingId: string): Promise<MeetingDetail> {
  const response = await fetchApi(`/api/meetings/${meetingId}`);
  const body = await parseJson<MeetingDetailApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar reunião."));
  }

  return mapMeetingDetail(body, meetingId);
}

export function formatMeetingDateTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
