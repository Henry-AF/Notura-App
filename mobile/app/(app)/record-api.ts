// Companion helper for `record.tsx` (Rule #8). Orchestrates the upload +
// process + status-polling pipeline. The screen never calls fetch directly —
// it only calls the functions exported here.

import { fetchApi } from '@/lib/api/client';
import { normalizeError, parseJson } from '@/lib/api-client';
import {
  initUpload,
  processMeeting,
  uploadToR2,
  MeetingUploadError,
  type UploadProgressListener,
} from '@/lib/meetings/upload';
import { fetchMeetingStatus, type MeetingStatusPayload } from '@/lib/meetings/status';
import { buildRecordingFileName, type RecordingFileInfo } from '@/lib/audio/recorder';

// ─── Post-processing navigation (extension point for NOT-115) ────────────────

// The Meetings tab (`app/(app)/index.tsx`) is the existing "Reuniões" screen.
// NOT-115 (meeting list/detail) will likely deep-link into a specific meeting;
// for this slice we just land back on the tab.
export const POST_PROCESSING_ROUTE = '/(app)' as const;

// ─── Processing step mapping ──────────────────────────────────────────────────
// Mirrors the `STEPS` ids from `src/app/dashboard/processing/page.tsx` on the
// web app — the same `processingStep` values are produced by the shared
// `/api/meetings/[id]/status` route, so the ids must stay in sync with that
// list. Labels/icons for these ids live in `record.tsx` (presentation only).

export type ProcessingStepId =
  | 'update-status-processing'
  | 'transcribe'
  | 'index-transcript-chunks'
  | 'summarize-meeting'
  | 'save-results'
  | 'send-whatsapp'
  | 'cleanup';

export const PROCESSING_STEP_IDS: readonly ProcessingStepId[] = [
  'update-status-processing',
  'transcribe',
  'index-transcript-chunks',
  'summarize-meeting',
  'save-results',
  'send-whatsapp',
  'cleanup',
];

export function mapStatusToStep(processingStep: string | null): number {
  if (!processingStep) return 0;
  const index = PROCESSING_STEP_IDS.indexOf(processingStep as ProcessingStepId);
  return index >= 0 ? index : 0;
}

// ─── WhatsApp number gating ────────────────────────────────────────────────────
// Per product decision: reuse the number already saved on the account, no
// input field in this slice. Only block the flow when the account is entitled
// to a WhatsApp summary but has no number saved at all.

interface CurrentUserApiResponse {
  user?: {
    whatsappNumber?: string;
    canSendWhatsAppSummary?: boolean;
  };
  error?: string;
}

export interface AccountWhatsappDefaults {
  whatsappNumber: string;
  canSendWhatsAppSummary: boolean;
}

export async function fetchAccountWhatsappDefaults(): Promise<AccountWhatsappDefaults> {
  const response = await fetchApi('/api/user/me');
  const body = await parseJson<CurrentUserApiResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, 'Erro ao carregar usuário.'));
  }

  return {
    whatsappNumber: body.user.whatsappNumber ?? '',
    canSendWhatsAppSummary: Boolean(body.user.canSendWhatsAppSummary),
  };
}

export interface WhatsappGate {
  blocked: boolean;
  whatsappNumber: string;
}

export function resolveWhatsappGate(defaults: AccountWhatsappDefaults): WhatsappGate {
  const blocked = defaults.canSendWhatsAppSummary && defaults.whatsappNumber.trim().length === 0;
  return { blocked, whatsappNumber: defaults.whatsappNumber };
}

// ─── Upload + process (NOT-44 mitigation) ────────────────────────────────────
// R2 presigned URLs and upload tokens expire after 900s. `startMeetingUpload`
// and `runProcess` are the low-level primitives; `submitMeetingRecording` is
// the retry-aware orchestrator the screen actually calls. On a 403 from
// either the R2 PUT (expired signature) or `/api/meetings/process` (expired
// token), it fetches a brand new presigned URL/token pair and retries the
// whole upload+process sequence. `/api/meetings/process` is idempotent by
// `audio_r2_key`, so retrying is safe (see NOT-44).

const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [500, 1500];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EXPIRED_TOKEN_MESSAGE = 'Token de upload expirado.';

// A 403 can mean several distinct things on the backend (see
// `src/lib/meetings/upload-token.ts` and `src/app/api/meetings/process/route.ts`):
// expired token, invalid/malformed token, ownership mismatch, or quota
// exceeded. Only the first is retryable — retrying the others either can't
// succeed (malformed token, ownership mismatch) or would bypass a deliberate
// business rule (quota). The backend surfaces a distinct, literal message per
// case, so the message — not the status alone — decides.
function isExpiredTokenError(error: unknown): boolean {
  return (
    error instanceof MeetingUploadError &&
    error.status === 403 &&
    error.message === EXPIRED_TOKEN_MESSAGE
  );
}

export interface StartMeetingUploadResult {
  r2Key: string;
  uploadToken: string;
}

// Requests a fresh presigned URL and streams the file to R2. Always requests
// a new pair right before the PUT, per the "use the freshest token available"
// mitigation for NOT-44.
export async function startMeetingUpload(
  fileInfo: RecordingFileInfo,
  onProgress?: UploadProgressListener
): Promise<StartMeetingUploadResult> {
  const { r2Key, uploadUrl, uploadToken } = await initUpload({
    fileName: buildRecordingFileName(),
    contentType: fileInfo.contentType,
    fileSize: fileInfo.fileSize,
  });

  await uploadToR2(uploadUrl, fileInfo.uri, fileInfo.contentType, onProgress);

  return { r2Key, uploadToken };
}

export interface RunProcessInput {
  meetingDate: string;
  r2Key: string;
  uploadToken: string;
  whatsappNumber?: string;
  groupId?: string | null;
}

export async function runProcess(input: RunProcessInput): Promise<string> {
  const result = await processMeeting(input);
  return result.meetingId;
}

export interface SubmitMeetingRecordingInput {
  fileInfo: RecordingFileInfo;
  meetingDate: string;
  whatsappNumber?: string;
  groupId?: string | null;
  onUploadProgress?: UploadProgressListener;
}

export async function submitMeetingRecording(input: SubmitMeetingRecordingInput): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const { r2Key, uploadToken } = await startMeetingUpload(input.fileInfo, input.onUploadProgress);
      return await runProcess({
        meetingDate: input.meetingDate,
        r2Key,
        uploadToken,
        whatsappNumber: input.whatsappNumber,
        groupId: input.groupId,
      });
    } catch (error) {
      lastError = error;
      const retryable = isExpiredTokenError(error) && attempt < MAX_UPLOAD_ATTEMPTS;
      if (!retryable) throw error;
      await wait(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha ao enviar reunião.');
}

// ─── Status polling ───────────────────────────────────────────────────────────

export interface StatusTick {
  status: MeetingStatusPayload['status'];
  stepIndex: number;
  meta: { title: string | null; taskCount: number; decisionCount: number };
  errorMessage: string | null;
}

function buildStatusTick(data: MeetingStatusPayload): StatusTick {
  return {
    status: data.status,
    stepIndex: mapStatusToStep(data.processingStep),
    meta: { title: data.title, taskCount: data.taskCount, decisionCount: data.decisionCount },
    errorMessage: data.errorMessage,
  };
}

export const POLL_INTERVAL_MS = 4000;

// Polls `/api/meetings/[id]/status` every `intervalMs` and calls `onTick` with
// a mapped `StatusTick`. Stops itself automatically once a terminal status
// (`completed`/`failed`) is reached. Returns a `stop()` function for the
// caller to invoke on unmount.
export function pollUntilTerminal(
  meetingId: string,
  onTick: (tick: StatusTick) => void,
  intervalMs: number = POLL_INTERVAL_MS
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    cancelled = true;
    if (timer) clearInterval(timer);
  }

  async function tick() {
    if (cancelled) return;
    try {
      const data = await fetchMeetingStatus(meetingId);
      if (cancelled) return;

      const statusTick = buildStatusTick(data);
      onTick(statusTick);

      if (statusTick.status === 'completed' || statusTick.status === 'failed') {
        stop();
      }
    } catch {
      // Transient network errors are ignored — polling keeps retrying.
    }
  }

  void tick();
  timer = setInterval(tick, intervalMs);
  return stop;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function getTodayDateStringUtc(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
