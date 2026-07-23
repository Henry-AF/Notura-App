import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export interface ExportAtaResult {
  url: string;
  filename: string;
  expiresIn: number;
}

interface ExportAtaApiResponse {
  url?: string;
  filename?: string;
  expiresIn?: number;
  error?: string;
}

export async function exportMeetingAta(meetingId: string): Promise<ExportAtaResult> {
  const response = await fetchApi(`/api/meetings/${meetingId}/export`, {
    method: "POST",
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

export async function shareMeetingAta(meetingId: string): Promise<void> {
  const result = await exportMeetingAta(meetingId);
  const localUri = await downloadAtaFile(result);
  await Sharing.shareAsync(localUri, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    dialogTitle: "Compartilhar ata",
    UTI: "org.openxmlformats.wordprocessingml.document",
  });
}
