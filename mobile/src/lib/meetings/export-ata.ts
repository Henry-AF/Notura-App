import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export interface ExportAtaResult {
  url: string;
  filename: string;
  expiresIn: number;
}

export interface MeetingTemplateOption {
  id: string;
  name: string;
}

interface ExportAtaApiResponse {
  url?: string;
  filename?: string;
  expiresIn?: number;
  error?: string;
}

interface MeetingTemplatesApiResponse {
  templates?: MeetingTemplateOption[];
  error?: string;
}

// Mobile is read-only for templates (NOT-158) — lists templates already
// registered via the web (NOT-84/130/131), no upload here.
export async function fetchMeetingTemplates(): Promise<MeetingTemplateOption[]> {
  const response = await fetchApi("/api/meeting-templates");
  const body = await parseJson<MeetingTemplatesApiResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar modelos de ata."));
  }

  return body.templates ?? [];
}

export async function exportMeetingAta(
  meetingId: string,
  templateId?: string
): Promise<ExportAtaResult> {
  const response = await fetchApi(`/api/meetings/${meetingId}/export`, {
    method: "POST",
    body: JSON.stringify(templateId ? { templateId } : {}),
  });
  const body = await parseJson<ExportAtaApiResponse>(response);

  if (!response.ok || !body.url || !body.filename) {
    throw new Error(normalizeError(body.error, "Erro ao gerar ata da reunião."));
  }

  return {
    url: body.url,
    filename: body.filename,
    expiresIn: body.expiresIn ?? 3600,
  };
}

export async function downloadAtaFile(result: ExportAtaResult): Promise<string> {
  const localUri = `${cacheDirectory}${result.filename}`;
  const download = await downloadAsync(result.url, localUri);

  if (download.status < 200 || download.status >= 300) {
    throw new Error(`Erro ${download.status} ao baixar ata.`);
  }

  return download.uri;
}

export async function shareMeetingAta(meetingId: string, templateId?: string): Promise<void> {
  const result = await exportMeetingAta(meetingId, templateId);
  const localUri = await downloadAtaFile(result);
  await Sharing.shareAsync(localUri, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    dialogTitle: "Compartilhar ata",
    UTI: "org.openxmlformats.wordprocessingml.document",
  });
}
