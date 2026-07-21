import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module";
import PizZip from "pizzip";

export const ALLOWED_PLACEHOLDERS = [
  "meeting_title",
  "meeting_date",
  "participants",
  "objective",
  "executive_summary",
  "topics",
  "decisions",
  "tasks",
  "next_steps",
] as const;

export type AllowedPlaceholder = (typeof ALLOWED_PLACEHOLDERS)[number];

const ALLOWED_PLACEHOLDER_SET: Set<string> = new Set(ALLOWED_PLACEHOLDERS);

export interface TemplateTagValidation {
  valid: boolean;
  unknown: string[];
}

export function extractTemplateTags(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const inspectModule = new InspectModule();
  new Docxtemplater(zip, { modules: [inspectModule] });

  return Object.keys(inspectModule.getAllTags());
}

export function validateTemplateTags(tags: string[]): TemplateTagValidation {
  const unknown = tags.filter((tag) => !ALLOWED_PLACEHOLDER_SET.has(tag));

  return {
    valid: unknown.length === 0,
    unknown,
  };
}
