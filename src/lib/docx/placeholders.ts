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

// Placeholders that receive an array of objects (buildAtaData) and therefore
// must be consumed as a Docxtemplater loop block ({#tag}...{/tag}), never as
// a plain scalar placeholder ({tag}) — see NOT-131.
export const ARRAY_PLACEHOLDERS = [
  "participants",
  "topics",
  "decisions",
  "tasks",
] as const;

export type ArrayPlaceholder = (typeof ARRAY_PLACEHOLDERS)[number];

const ALLOWED_PLACEHOLDER_SET: Set<string> = new Set(ALLOWED_PLACEHOLDERS);
const ARRAY_PLACEHOLDER_SET: Set<string> = new Set(ARRAY_PLACEHOLDERS);

export type StructuredTag = ReturnType<
  InstanceType<typeof InspectModule>["getAllStructuredTags"]
>[number];

export interface TemplateTagValidation {
  valid: boolean;
  unknown: string[];
  hasNoTags: boolean;
  invalidScalarArrayTags: string[];
}

function inspectBuffer(buffer: Buffer): InspectModule {
  const zip = new PizZip(buffer);
  const inspectModule = new InspectModule();
  new Docxtemplater(zip, { modules: [inspectModule] });

  return inspectModule;
}

export function extractTemplateTags(buffer: Buffer): string[] {
  return Object.keys(inspectBuffer(buffer).getAllTags());
}

export function extractStructuredTags(buffer: Buffer): StructuredTag[] {
  return inspectBuffer(buffer).getAllStructuredTags();
}

function isUsedAsLoop(tag: string, structuredTags: StructuredTag[]): boolean {
  return structuredTags.some(
    (part) => part.value === tag && part.module === "loop"
  );
}

export function findInvalidScalarArrayTags(
  tags: string[],
  structuredTags: StructuredTag[]
): string[] {
  return tags.filter(
    (tag) => ARRAY_PLACEHOLDER_SET.has(tag) && !isUsedAsLoop(tag, structuredTags)
  );
}

export function validateTemplateTags(
  tags: string[],
  structuredTags: StructuredTag[]
): TemplateTagValidation {
  const unknown = tags.filter((tag) => !ALLOWED_PLACEHOLDER_SET.has(tag));
  const hasNoTags = tags.length === 0;
  const invalidScalarArrayTags = findInvalidScalarArrayTags(tags, structuredTags);

  return {
    valid: unknown.length === 0 && !hasNoTags && invalidScalarArrayTags.length === 0,
    unknown,
    hasNoTags,
    invalidScalarArrayTags,
  };
}
