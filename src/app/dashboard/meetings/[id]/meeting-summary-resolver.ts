import type { MeetingStructuredSummary, Priority } from "@/types/database";
import type { MeetingParticipantDisplay } from "./meeting-types";

const UNKNOWN_PARTICIPANT_NAME = "Participante removido";

export function resolveSummary(
  json: MeetingStructuredSummary | null,
  participants: MeetingParticipantDisplay[],
  fallbackText = ""
): string {
  if (!json) return fallbackText;

  const participantById = new Map(
    participants
      .filter((participant) => Boolean(participant.id))
      .map((participant) => [participant.id, participant.name])
  );
  const sections = json.sections.map((section) =>
    formatSection(section, participantById)
  );
  const actionItems = json.action_items.map((item) =>
    formatActionItem(item, participantById)
  );
  const parts = [
    json.title ? `Reunião: ${json.title}` : null,
    ...sections,
    actionItems.length > 0 ? ["Tarefas", ...actionItems].join("\n") : null,
  ];

  return parts.filter((part): part is string => Boolean(part)).join("\n\n");
}

function formatSection(
  section: MeetingStructuredSummary["sections"][number],
  participantById: Map<string | undefined, string>
): string {
  const participantNames = section.participant_ids.map((id) =>
    participantById.get(id) ?? UNKNOWN_PARTICIPANT_NAME
  );
  const suffix =
    participantNames.length > 0
      ? `\nParticipantes citados: ${participantNames.join(", ")}`
      : "";

  return `${section.title}\n${section.content}${suffix}`;
}

function formatActionItem(
  item: MeetingStructuredSummary["action_items"][number],
  participantById: Map<string | undefined, string>
): string {
  const owner = item.participant_id
    ? participantById.get(item.participant_id) ?? UNKNOWN_PARTICIPANT_NAME
    : "A definir";
  const dueDate = item.due_date ? ` / ${item.due_date}` : "";
  return `${owner} - ${item.description}${dueDate} (${formatPriority(item.priority)})`;
}

function formatPriority(priority: Priority): string {
  if (priority === "alta") return "alta";
  if (priority === "baixa") return "baixa";
  return "média";
}
