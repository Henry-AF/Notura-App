import { z } from "zod";
import type {
  MeetingJSON,
  MeetingParticipantRole,
  MeetingStructuredSummary,
  Priority,
} from "@/types/database";

const prioritySchema = z.enum(["alta", "média", "baixa"]);
const participantRoleSchema = z.enum(["participant", "entity"]);

const participantDraftSchema = z.object({
  ref: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  original_name: z.string().trim().min(1),
  role: participantRoleSchema,
});

const summarySectionDraftSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  participant_refs: z.array(z.string().trim().min(1)).default([]),
});

const actionItemDraftSchema = z.object({
  description: z.string().trim().min(1),
  participant_ref: z.string().trim().min(1).nullable(),
  due_date: z.string().trim().min(1).nullable(),
  priority: prioritySchema.default("média"),
});

const structuredSummaryDraftSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().min(1).nullable(),
  sections: z.array(summarySectionDraftSchema),
  action_items: z.array(actionItemDraftSchema),
});

const meetingJsonSchema = z
  .object({
    decisions: z.array(z.unknown()),
    tasks: z.array(z.unknown()),
    open_items: z.array(z.unknown()),
  })
  .passthrough();

const geminiMeetingSummaryEnvelopeSchema = z.object({
  participants: z.array(participantDraftSchema),
  summary_whatsapp: z.string().trim().min(1),
  summary_json: meetingJsonSchema,
  summary_structured: structuredSummaryDraftSchema,
});

export interface GeminiMeetingParticipantDraft {
  ref: string;
  displayName: string;
  originalName: string;
  role: MeetingParticipantRole;
}

export interface StructuredSummarySectionDraft {
  title: string;
  content: string;
  participantRefs: string[];
}

export interface StructuredSummaryActionItemDraft {
  description: string;
  participantRef: string | null;
  dueDate: string | null;
  priority: Priority;
}

export interface StructuredSummaryDraft {
  version: number;
  title: string | null;
  sections: StructuredSummarySectionDraft[];
  actionItems: StructuredSummaryActionItemDraft[];
}

export interface ParsedGeminiMeetingSummaryEnvelope {
  participants: GeminiMeetingParticipantDraft[];
  summaryWhatsapp: string;
  summaryJson: MeetingJSON;
  summaryStructured: StructuredSummaryDraft;
}

export interface ParticipantRefTarget {
  id: string;
  role: MeetingParticipantRole;
}

export type ParticipantRefMap = Partial<Record<string, ParticipantRefTarget>>;

export function parseGeminiMeetingSummaryEnvelope(
  value: unknown
): ParsedGeminiMeetingSummaryEnvelope {
  const parsed = geminiMeetingSummaryEnvelopeSchema.parse(value);
  const participants = parsed.participants.map(toParticipantDraft);
  const summaryStructured = toStructuredSummaryDraft(parsed.summary_structured);

  validateStructuredRefs(summaryStructured, participants);

  return {
    participants,
    summaryWhatsapp: parsed.summary_whatsapp,
    summaryJson: parsed.summary_json as MeetingJSON,
    summaryStructured,
  };
}

export function rewriteStructuredSummaryRefs(
  summary: StructuredSummaryDraft,
  participantRefs: ParticipantRefMap
): MeetingStructuredSummary {
  return {
    version: summary.version,
    title: summary.title,
    sections: summary.sections.map((section) =>
      rewriteSectionRefs(section, participantRefs)
    ),
    action_items: summary.actionItems.map((item) =>
      rewriteActionItemRef(item, participantRefs)
    ),
  };
}

function toParticipantDraft(
  participant: z.infer<typeof participantDraftSchema>
): GeminiMeetingParticipantDraft {
  return {
    ref: participant.ref,
    displayName: participant.display_name,
    originalName: participant.original_name,
    role: participant.role,
  };
}

function toStructuredSummaryDraft(
  summary: z.infer<typeof structuredSummaryDraftSchema>
): StructuredSummaryDraft {
  return {
    version: summary.version,
    title: summary.title,
    sections: summary.sections.map((section) => ({
      title: section.title,
      content: section.content,
      participantRefs: section.participant_refs,
    })),
    actionItems: summary.action_items.map((item) => ({
      description: item.description,
      participantRef: item.participant_ref,
      dueDate: item.due_date,
      priority: item.priority,
    })),
  };
}

function validateStructuredRefs(
  summary: StructuredSummaryDraft,
  participants: GeminiMeetingParticipantDraft[]
) {
  const roleByRef = new Map(participants.map((participant) => [
    participant.ref,
    participant.role,
  ]));
  const refs = collectStructuredRefs(summary);
  const missingRefs = refs.filter((ref) => !roleByRef.has(ref));

  if (missingRefs.length > 0) {
    throw new Error("Gemini returned structured summary refs that were not declared");
  }

  validateActionItemRefs(summary, roleByRef);
}

function collectStructuredRefs(summary: StructuredSummaryDraft): string[] {
  return [
    ...summary.sections.flatMap((section) => section.participantRefs),
    ...summary.actionItems.flatMap((item) =>
      item.participantRef ? [item.participantRef] : []
    ),
  ];
}

function validateActionItemRefs(
  summary: StructuredSummaryDraft,
  roleByRef: Map<string, MeetingParticipantRole>
) {
  const hasEntityOwner = summary.actionItems.some((item) => {
    if (!item.participantRef) return false;
    return roleByRef.get(item.participantRef) === "entity";
  });

  if (hasEntityOwner) {
    throw new Error("Action item participant_ref must point to a participant");
  }
}

function rewriteSectionRefs(
  section: StructuredSummarySectionDraft,
  participantRefs: ParticipantRefMap
) {
  return {
    title: section.title,
    content: section.content,
    participant_ids: section.participantRefs.map((ref) => resolveRefId(ref, participantRefs)),
  };
}

function rewriteActionItemRef(
  item: StructuredSummaryActionItemDraft,
  participantRefs: ParticipantRefMap
) {
  return {
    description: item.description,
    participant_id: item.participantRef
      ? resolveParticipantOwnerRef(item.participantRef, participantRefs)
      : null,
    due_date: item.dueDate,
    priority: item.priority,
  };
}

function resolveRefId(ref: string, participantRefs: ParticipantRefMap): string {
  const target = participantRefs[ref];
  if (!target) {
    throw new Error("Structured summary contains an unknown participant ref");
  }

  return target.id;
}

function resolveParticipantOwnerRef(
  ref: string,
  participantRefs: ParticipantRefMap
): string {
  const target = participantRefs[ref];
  if (!target) {
    throw new Error("Structured summary contains an unknown participant ref");
  }

  if (target.role !== "participant") {
    throw new Error("Action item participant_ref must point to a participant");
  }

  return target.id;
}
