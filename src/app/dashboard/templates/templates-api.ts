import { normalizeError, parseJson } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
  editable: boolean;
  createdAt?: string;
}

export class TemplatePlanRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplatePlanRequiredError";
  }
}

export class InvalidTemplatePlaceholdersError extends Error {
  readonly unknownPlaceholders: string[];

  constructor(message: string, unknownPlaceholders: string[]) {
    super(message);
    this.name = "InvalidTemplatePlaceholdersError";
    this.unknownPlaceholders = unknownPlaceholders;
  }
}

interface TemplatesListResponse {
  templates?: TemplateOption[];
  error?: string;
}

interface RawMeetingTemplate {
  id: string;
  name: string;
  created_at: string;
}

interface TemplateUploadResponse {
  template?: RawMeetingTemplate;
  error?: string;
  unknownPlaceholders?: string[];
}

interface TemplateDeleteResponse {
  error?: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export function mapTemplatesResponse(templates: TemplateOption[]): TemplateOption[] {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    isDefault: template.isDefault,
    editable: template.editable,
    createdAt: template.createdAt,
  }));
}

export function mapUploadedTemplate(row: RawMeetingTemplate): TemplateOption {
  return {
    id: row.id,
    name: row.name,
    isDefault: false,
    editable: true,
    createdAt: row.created_at,
  };
}

// ─── Fetch functions ──────────────────────────────────────────────────────────

export async function fetchTemplates(): Promise<TemplateOption[]> {
  const response = await fetch("/api/meeting-templates");
  const body = await parseJson<TemplatesListResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar modelos de ata."));
  }

  return mapTemplatesResponse(body.templates ?? []);
}

export async function uploadTemplate(file: File, name: string): Promise<TemplateOption> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);

  const response = await fetch("/api/meeting-templates", {
    method: "POST",
    body: formData,
  });
  const body = await parseJson<TemplateUploadResponse>(response);

  if (response.status === 403) {
    throw new TemplatePlanRequiredError(
      normalizeError(body.error, "Recurso disponível apenas para o plano Pro.")
    );
  }

  if (response.status === 422 && body.unknownPlaceholders) {
    throw new InvalidTemplatePlaceholdersError(
      normalizeError(body.error, "O modelo contém placeholders desconhecidos."),
      body.unknownPlaceholders
    );
  }

  if (!response.ok || !body.template) {
    throw new Error(normalizeError(body.error, "Erro ao salvar modelo de ata."));
  }

  return mapUploadedTemplate(body.template);
}

export async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`/api/meeting-templates/${id}`, {
    method: "DELETE",
  });

  if (response.ok) return;

  const body = await parseJson<TemplateDeleteResponse>(response).catch(
    (): TemplateDeleteResponse => ({})
  );

  if (response.status === 403) {
    throw new TemplatePlanRequiredError(
      normalizeError(body.error, "Você não pode remover este modelo.")
    );
  }

  throw new Error(normalizeError(body.error, "Erro ao remover modelo de ata."));
}
