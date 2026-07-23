// Wraps the `/api/meetings/upload` + R2 PUT + `/api/meetings/process` calls
// that the mobile recording flow reuses verbatim from the web app (NOT-113).
// These routes are NOT modified by the mobile app — see ARCHITECTURE.md.

import { fetchApi } from '@/lib/api/client';
import { normalizeError, parseJson } from '@/lib/api-client';
import * as FileSystemLegacy from 'expo-file-system/legacy';

// Thrown by every function in this module so callers can branch on the HTTP
// status (used by the NOT-44 retry-on-expired-token mitigation in
// `app/(app)/record-api.ts`).
export class MeetingUploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MeetingUploadError';
    this.status = status;
  }
}

export interface InitUploadInput {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface InitUploadResult {
  r2Key: string;
  uploadUrl: string;
  uploadToken: string;
}

interface UploadInitApiResponse {
  r2Key?: string;
  uploadUrl?: string;
  uploadToken?: string;
  error?: string;
}

export async function initUpload(input: InitUploadInput): Promise<InitUploadResult> {
  const response = await fetchApi('/api/meetings/upload', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body = await parseJson<UploadInitApiResponse>(response);

  if (!response.ok) {
    throw new MeetingUploadError(
      normalizeError(body.error, 'Erro ao preparar upload. Tente novamente.'),
      response.status
    );
  }

  if (!body.r2Key || !body.uploadUrl || !body.uploadToken) {
    throw new MeetingUploadError('Resposta inválida do servidor ao iniciar upload.', response.status);
  }

  return { r2Key: body.r2Key, uploadUrl: body.uploadUrl, uploadToken: body.uploadToken };
}

export type UploadProgressListener = (percent: number) => void;

// Streams the recorded file straight from disk to the presigned R2 URL using
// `expo-file-system`'s upload task, which reports real progress without ever
// loading the whole file into memory. This intentionally bypasses `fetchApi`
// (it forces `content-type: application/json`, which would break the binary
// PUT) and does not carry the Supabase Bearer token — R2 authorizes the
// request via the presigned signature instead.
export async function uploadToR2(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onProgress?: UploadProgressListener
): Promise<void> {
  const task = FileSystemLegacy.createUploadTask(
    uploadUrl,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    },
    (data) => {
      if (!onProgress || data.totalBytesExpectedToSend <= 0) return;
      onProgress(Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100));
    }
  );

  const result = await task.uploadAsync();
  const status = result?.status ?? 0;

  if (status < 200 || status >= 300) {
    throw new MeetingUploadError(`Erro ${status} ao enviar arquivo para storage.`, status);
  }
}

export interface ProcessMeetingInput {
  meetingDate: string;
  r2Key: string;
  uploadToken: string;
  whatsappNumber?: string;
  groupId?: string | null;
}

interface ProcessMeetingApiResponse {
  meetingId?: string;
  error?: string;
}

export interface ProcessMeetingResult {
  meetingId: string;
}

export async function processMeeting(input: ProcessMeetingInput): Promise<ProcessMeetingResult> {
  const response = await fetchApi('/api/meetings/process', {
    method: 'POST',
    body: JSON.stringify({
      meetingDate: input.meetingDate,
      r2Key: input.r2Key,
      uploadToken: input.uploadToken,
      ...(input.whatsappNumber ? { whatsappNumber: input.whatsappNumber } : {}),
      ...(input.groupId ? { groupId: input.groupId } : {}),
    }),
  });
  const body = await parseJson<ProcessMeetingApiResponse>(response);

  if (!response.ok) {
    throw new MeetingUploadError(
      normalizeError(
        body.error,
        'Houve um erro ao iniciar o processamento desta reunião. Tente processar novamente.'
      ),
      response.status
    );
  }

  if (!body.meetingId) {
    throw new MeetingUploadError('Resposta inválida do servidor ao criar reunião.', response.status);
  }

  return { meetingId: body.meetingId };
}
