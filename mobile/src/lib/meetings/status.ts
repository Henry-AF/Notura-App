// Mirrors `src/app/dashboard/processing/processing-api.ts` from the web app:
// polls `/api/meetings/[id]/status` (unmodified route, withAuth + requireOwnership).

import { fetchApi } from '@/lib/api/client';
import { normalizeError, parseJson } from '@/lib/api-client';

export type MeetingProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface MeetingStatusPayload {
  id: string;
  title: string | null;
  status: MeetingProcessingStatus;
  processingStep: string | null;
  jobStatus: string | null;
  errorMessage: string | null;
  taskCount: number;
  decisionCount: number;
}

interface MeetingStatusApiResponse {
  id?: string;
  title?: string | null;
  status?: string;
  processingStep?: string | null;
  jobStatus?: string | null;
  errorMessage?: string | null;
  taskCount?: number;
  decisionCount?: number;
  error?: string;
}

function normalizeMeetingProcessingStatus(status: string): MeetingProcessingStatus {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'pending') return 'pending';
  return 'processing';
}

export async function fetchMeetingStatus(meetingId: string): Promise<MeetingStatusPayload> {
  const response = await fetchApi(`/api/meetings/${meetingId}/status`);
  const body = await parseJson<MeetingStatusApiResponse>(response);

  if (!response.ok || !body.id || typeof body.status !== 'string') {
    throw new Error(normalizeError(body.error, 'Erro ao carregar status da reunião.'));
  }

  return {
    id: body.id,
    title: body.title ?? null,
    status: normalizeMeetingProcessingStatus(body.status),
    processingStep: typeof body.processingStep === 'string' ? body.processingStep : null,
    jobStatus: typeof body.jobStatus === 'string' ? body.jobStatus : null,
    errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : null,
    taskCount: body.taskCount ?? 0,
    decisionCount: body.decisionCount ?? 0,
  };
}
