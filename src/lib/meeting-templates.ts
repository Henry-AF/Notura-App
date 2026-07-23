import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwnership } from "@/lib/api/auth";
import { getCustomTemplateAccess } from "@/lib/billing/custom-template-access";
import { deleteAudio, downloadAudio } from "@/lib/r2";
import type { Database, MeetingTemplate } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export const DEFAULT_TEMPLATE_ID = "default";
// Resolve from the project root (process.cwd() === "/var/task" on Vercel) instead
// of __dirname: webpack rewrites __dirname to the compiled chunk directory at
// runtime, so the file was looked up under .next/server/chunks/... where it is
// never emitted (the ENOENT in production). The template is copied into the
// serverless function via `outputFileTracingIncludes` in next.config.mjs, which
// preserves this path relative to the project root.
const DEFAULT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "docx",
  "templates",
  "default-ata.docx"
);

export class MeetingTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeetingTemplateValidationError";
  }
}

export class MeetingTemplateNotFoundError extends Error {
  readonly status = 404;

  constructor(message = "Modelo de ata não encontrado.") {
    super(message);
    this.name = "MeetingTemplateNotFoundError";
  }
}

export interface MeetingTemplateSummary {
  id: string;
  name: string;
  isDefault: boolean;
  editable: boolean;
  createdAt?: string;
}

export interface CreateMeetingTemplateInput {
  name: string;
  r2Key: string;
  originalFilename: string | null;
  placeholders: string[];
}

export function normalizeTemplateName(name: unknown): string {
  if (typeof name !== "string") {
    throw new MeetingTemplateValidationError("Nome do modelo é obrigatório.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new MeetingTemplateValidationError("Nome do modelo é obrigatório.");
  }

  if (trimmed.length > 80) {
    throw new MeetingTemplateValidationError(
      "Nome do modelo deve ter até 80 caracteres."
    );
  }

  return trimmed;
}

function toSummary(row: {
  id: string;
  name: string;
  created_at: string;
}): MeetingTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    isDefault: false,
    editable: true,
    createdAt: row.created_at,
  };
}

function defaultTemplateSummary(): MeetingTemplateSummary {
  return {
    id: DEFAULT_TEMPLATE_ID,
    name: "Modelo padrão",
    isDefault: true,
    editable: false,
  };
}

async function fetchCustomTemplateRows(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from("meeting_templates")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Erro ao carregar modelos de ata.");
  }

  return data ?? [];
}

export async function listTemplatesForUser(
  supabaseAdmin: SupabaseAdminClient,
  userId: string
): Promise<MeetingTemplateSummary[]> {
  const access = await getCustomTemplateAccess(userId, supabaseAdmin);

  if (!access.canUseCustomTemplates) {
    return [defaultTemplateSummary()];
  }

  const rows = await fetchCustomTemplateRows(supabaseAdmin, userId);
  return [defaultTemplateSummary(), ...rows.map(toSummary)];
}

export async function createTemplate(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  input: CreateMeetingTemplateInput
): Promise<MeetingTemplate> {
  const name = normalizeTemplateName(input.name);
  const { data, error } = await supabaseAdmin
    .from("meeting_templates")
    .insert({
      user_id: userId,
      name,
      r2_key: input.r2Key,
      original_filename: input.originalFilename,
      placeholders: input.placeholders,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Erro ao salvar modelo de ata.");
  }

  return data;
}

export async function deleteTemplate(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  templateId: string
): Promise<void> {
  await requireOwnership(supabaseAdmin, "meeting_templates", templateId, userId);

  const { data, error: fetchError } = await supabaseAdmin
    .from("meeting_templates")
    .select("r2_key")
    .eq("id", templateId)
    .single();

  if (fetchError || !data) {
    throw new MeetingTemplateNotFoundError();
  }

  await deleteAudio(data.r2_key);

  const { error } = await supabaseAdmin
    .from("meeting_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    throw new Error("Erro ao remover modelo de ata.");
  }
}

async function fetchCustomTemplateBuffer(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  templateId: string
): Promise<Buffer> {
  await requireOwnership(supabaseAdmin, "meeting_templates", templateId, userId);

  const { data, error } = await supabaseAdmin
    .from("meeting_templates")
    .select("r2_key")
    .eq("id", templateId)
    .single();

  if (error || !data) {
    throw new MeetingTemplateNotFoundError();
  }

  return downloadAudio(data.r2_key);
}

export async function resolveTemplateBuffer(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  templateId: string
): Promise<Buffer> {
  if (templateId === DEFAULT_TEMPLATE_ID) {
    return readFileSync(DEFAULT_TEMPLATE_PATH);
  }

  return fetchCustomTemplateBuffer(supabaseAdmin, userId, templateId);
}
