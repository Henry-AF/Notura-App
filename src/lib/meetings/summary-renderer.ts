import type {
  MeetingJSON,
  MeetingParticipant,
  MeetingStructuredSummary,
  Priority,
} from "@/types/database";

const UNKNOWN_PARTICIPANT_NAME = "Participante removido";

export interface RenderedMeetingSummary {
  text: string;
  participants: Array<{
    id?: string;
    name: string;
    originalName?: string;
    role?: "participant";
  }>;
  entities: Array<{
    id: string;
    name: string;
    originalName: string;
    role: "entity";
  }>;
  sections: Array<{ title: string; content: string; participants: string[] }>;
  actionItems: Array<{
    description: string;
    participantId: string | null;
    participantName: string | null;
    dueDate: string | null;
    priority: Priority;
  }>;
}

export interface RenderMeetingSummaryInput {
  summaryStructured: MeetingStructuredSummary | null;
  meetingParticipants: MeetingParticipant[];
  summaryWhatsapp: string | null;
  summaryJson: MeetingJSON | null;
}

export function renderMeetingSummary(
  input: RenderMeetingSummaryInput
): RenderedMeetingSummary {
  if (!input.summaryStructured) {
    return renderLegacySummary(input.summaryWhatsapp, input.summaryJson);
  }

  const participantById = new Map(
    input.meetingParticipants.map((participant) => [participant.id, participant])
  );
  const participants = renderParticipantList(input.meetingParticipants);
  const entities = renderEntityList(input.meetingParticipants);
  const sections = renderSections(input.summaryStructured, participantById);
  const actionItems = renderActionItems(input.summaryStructured, participantById);
  const text = input.summaryWhatsapp
    ? resolveSummaryWhatsappText(
        input.summaryWhatsapp,
        input.meetingParticipants,
        participants.map((participant) => participant.name)
      )
    : buildStructuredSummaryText(input.summaryStructured.title, sections, actionItems);

  return {
    text,
    participants,
    entities,
    sections,
    actionItems,
  };
}

function renderLegacySummary(
  summaryWhatsapp: string | null,
  summaryJson: MeetingJSON | null
): RenderedMeetingSummary {
  const participants = summaryJson?.meeting?.participants ?? [];

  return {
    text: summaryWhatsapp ?? "",
    participants: participants
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
    entities: [],
    sections: [],
    actionItems: [],
  };
}

function renderSections(
  summary: MeetingStructuredSummary,
  participantById: Map<string, MeetingParticipant>
): RenderedMeetingSummary["sections"] {
  return summary.sections.map((section) => ({
    title: section.title,
    content: section.content,
    participants: section.participant_ids.map((id) =>
      resolveParticipantName(id, participantById)
    ),
  }));
}

function renderActionItems(
  summary: MeetingStructuredSummary,
  participantById: Map<string, MeetingParticipant>
): RenderedMeetingSummary["actionItems"] {
  return summary.action_items.map((item) => ({
    description: item.description,
    participantId: item.participant_id,
    participantName: item.participant_id
      ? resolveParticipantName(item.participant_id, participantById)
      : null,
    dueDate: item.due_date,
    priority: item.priority,
  }));
}

function renderParticipantList(meetingParticipants: MeetingParticipant[]) {
  return meetingParticipants
    .filter((participant) => participant.role === "participant")
    .map((participant) => ({
      id: participant.id,
      name: participant.display_name,
      originalName: participant.original_name,
      role: "participant" as const,
    }));
}

function renderEntityList(meetingParticipants: MeetingParticipant[]) {
  return meetingParticipants
    .filter((participant) => participant.role === "entity")
    .map((participant) => ({
      id: participant.id,
      name: participant.display_name,
      originalName: participant.original_name,
      role: "entity" as const,
    }));
}

function resolveParticipantName(
  participantId: string,
  participantById: Map<string, MeetingParticipant>
): string {
  return participantById.get(participantId)?.display_name ?? UNKNOWN_PARTICIPANT_NAME;
}

function buildStructuredSummaryText(
  title: string | null,
  sections: RenderedMeetingSummary["sections"],
  actionItems: RenderedMeetingSummary["actionItems"]
): string {
  const parts = [
    title ? `Reunião: ${title}` : null,
    ...sections.map(formatSectionText),
    actionItems.length > 0 ? formatActionItemsText(actionItems) : null,
  ];

  return parts.filter((part): part is string => Boolean(part)).join("\n\n");
}

function formatSectionText(section: RenderedMeetingSummary["sections"][number]) {
  const participants =
    section.participants.length > 0
      ? `\nParticipantes citados: ${section.participants.join(", ")}`
      : "";

  return `${section.title}\n${section.content}${participants}`;
}

function formatActionItemsText(
  actionItems: RenderedMeetingSummary["actionItems"]
) {
  const lines = actionItems.map((item) => {
    const owner = item.participantName ?? "A definir";
    const dueDate = item.dueDate ? ` / ${item.dueDate}` : "";
    return `• ${owner} — ${item.description}${dueDate}`;
  });

  return ["Tarefas", ...lines].join("\n");
}

function resolveParticipantNamesInText(
  text: string,
  meetingParticipants: MeetingParticipant[]
) {
  return meetingParticipants
    .filter((participant) => participant.original_name !== participant.display_name)
    .sort((a, b) => b.original_name.length - a.original_name.length)
    .reduce(
      (summary, participant) =>
        summary.split(participant.original_name).join(participant.display_name),
      text
    );
}

function resolveSummaryWhatsappText(
  text: string,
  meetingParticipants: MeetingParticipant[],
  participantNames: string[]
) {
  return replaceParticipantsLine(
    resolveParticipantNamesInText(text, meetingParticipants),
    participantNames
  );
}

function replaceParticipantsLine(text: string, participantNames: string[]) {
  const participantsText =
    participantNames.length > 0
      ? participantNames.join(", ")
      : "Participante não identificado";

  return text.replace(/^Participantes:\s*.*$/m, `Participantes: ${participantsText}`);
}
