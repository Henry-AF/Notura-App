import { fetchApi } from '@/lib/api/client';
import { initUpload, uploadToR2, processMeeting, MeetingUploadError } from '@/lib/meetings/upload';
import { fetchMeetingStatus } from '@/lib/meetings/status';
import { buildRecordingFileName } from '@/lib/audio/recorder';
import {
  mapStatusToStep,
  resolveWhatsappGate,
  fetchAccountWhatsappDefaults,
  getTodayDateStringUtc,
  startMeetingUpload,
  runProcess,
  submitMeetingRecording,
  pollUntilTerminal,
  POST_PROCESSING_ROUTE,
} from './record-api';

jest.mock('@/lib/api/client', () => ({
  fetchApi: jest.fn(),
}));

jest.mock('@/lib/meetings/upload', () => {
  const actual = jest.requireActual('@/lib/meetings/upload');
  return {
    ...actual,
    initUpload: jest.fn(),
    uploadToR2: jest.fn(),
    processMeeting: jest.fn(),
  };
});

jest.mock('@/lib/meetings/status', () => ({
  fetchMeetingStatus: jest.fn(),
}));

// Not using `jest.requireActual` here: the real module imports `expo-audio`,
// which pulls in native-only dependencies that don't resolve under Jest.
// `record-api.ts` only needs `buildRecordingFileName` from this module.
jest.mock('@/lib/audio/recorder', () => ({
  buildRecordingFileName: jest.fn(() => 'notura-recording-123.m4a'),
}));

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

const mockedFetchApi = fetchApi as jest.Mock;
const mockedInitUpload = initUpload as jest.Mock;
const mockedUploadToR2 = uploadToR2 as jest.Mock;
const mockedProcessMeeting = processMeeting as jest.Mock;
const mockedFetchMeetingStatus = fetchMeetingStatus as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (buildRecordingFileName as jest.Mock).mockReturnValue('notura-recording-123.m4a');
});

// ─── POST_PROCESSING_ROUTE ────────────────────────────────────────────────────

describe('POST_PROCESSING_ROUTE', () => {
  it('points to the Reuniões tab', () => {
    expect(POST_PROCESSING_ROUTE).toBe('/(app)');
  });
});

// ─── mapStatusToStep ──────────────────────────────────────────────────────────

describe('mapStatusToStep', () => {
  it('returns 0 when processingStep is null', () => {
    expect(mapStatusToStep(null)).toBe(0);
  });

  it('returns the matching index for a known step id', () => {
    expect(mapStatusToStep('summarize-meeting')).toBe(3);
  });

  it('returns 0 for an unrecognized step id', () => {
    expect(mapStatusToStep('some-unknown-step')).toBe(0);
  });
});

// ─── resolveWhatsappGate ──────────────────────────────────────────────────────

describe('resolveWhatsappGate', () => {
  it('blocks when the account can send WhatsApp summaries but has no number saved', () => {
    const gate = resolveWhatsappGate({ whatsappNumber: '', canSendWhatsAppSummary: true });
    expect(gate.blocked).toBe(true);
  });

  it('does not block when a number is saved', () => {
    const gate = resolveWhatsappGate({ whatsappNumber: '5511999999999', canSendWhatsAppSummary: true });
    expect(gate.blocked).toBe(false);
    expect(gate.whatsappNumber).toBe('5511999999999');
  });

  it('does not block when the account cannot send WhatsApp summaries', () => {
    const gate = resolveWhatsappGate({ whatsappNumber: '', canSendWhatsAppSummary: false });
    expect(gate.blocked).toBe(false);
  });
});

// ─── fetchAccountWhatsappDefaults ─────────────────────────────────────────────

describe('fetchAccountWhatsappDefaults', () => {
  it('returns mapped defaults on success', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ user: { whatsappNumber: '5511999999999', canSendWhatsAppSummary: true } })
    );

    const result = await fetchAccountWhatsappDefaults();

    expect(result).toEqual({ whatsappNumber: '5511999999999', canSendWhatsAppSummary: true });
  });

  it('defaults whatsappNumber to empty string when absent', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ user: { canSendWhatsAppSummary: false } }));

    const result = await fetchAccountWhatsappDefaults();

    expect(result).toEqual({ whatsappNumber: '', canSendWhatsAppSummary: false });
  });

  it('throws the API error message on failure', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Não autorizado' }, { ok: false, status: 401 })
    );

    await expect(fetchAccountWhatsappDefaults()).rejects.toThrow('Não autorizado');
  });
});

// ─── getTodayDateStringUtc ────────────────────────────────────────────────────

describe('getTodayDateStringUtc', () => {
  it('formats a fixed date as YYYY-MM-DD in UTC', () => {
    const fixed = new Date('2026-07-23T23:59:00.000Z');
    expect(getTodayDateStringUtc(fixed)).toBe('2026-07-23');
  });
});

// ─── startMeetingUpload ───────────────────────────────────────────────────────

describe('startMeetingUpload', () => {
  it('inits the upload and streams the file to R2', async () => {
    mockedInitUpload.mockResolvedValueOnce({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-abc',
    });
    mockedUploadToR2.mockResolvedValueOnce(undefined);

    const onProgress = jest.fn();
    const result = await startMeetingUpload(
      { uri: 'file:///rec.m4a', fileSize: 1024, contentType: 'audio/m4a' },
      onProgress
    );

    expect(mockedInitUpload).toHaveBeenCalledWith({
      fileName: 'notura-recording-123.m4a',
      contentType: 'audio/m4a',
      fileSize: 1024,
    });
    expect(mockedUploadToR2).toHaveBeenCalledWith(
      'https://r2.example.com/put',
      'file:///rec.m4a',
      'audio/m4a',
      onProgress
    );
    expect(result).toEqual({ r2Key: 'users/1/rec.m4a', uploadToken: 'token-abc' });
  });
});

// ─── runProcess ───────────────────────────────────────────────────────────────

describe('runProcess', () => {
  it('returns the meetingId from processMeeting', async () => {
    mockedProcessMeeting.mockResolvedValueOnce({ meetingId: 'meeting-1' });

    const meetingId = await runProcess({
      meetingDate: '2026-07-23',
      r2Key: 'users/1/rec.m4a',
      uploadToken: 'token-abc',
    });

    expect(meetingId).toBe('meeting-1');
  });
});

// ─── submitMeetingRecording (NOT-44 retry) ────────────────────────────────────

describe('submitMeetingRecording', () => {
  const fileInfo = { uri: 'file:///rec.m4a', fileSize: 2048, contentType: 'audio/m4a' };

  it('succeeds on the first attempt without retrying', async () => {
    mockedInitUpload.mockResolvedValue({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-1',
    });
    mockedUploadToR2.mockResolvedValue(undefined);
    mockedProcessMeeting.mockResolvedValue({ meetingId: 'meeting-1' });

    const meetingId = await submitMeetingRecording({ fileInfo, meetingDate: '2026-07-23' });

    expect(meetingId).toBe('meeting-1');
    expect(mockedInitUpload).toHaveBeenCalledTimes(1);
    expect(mockedProcessMeeting).toHaveBeenCalledTimes(1);
  });

  it('retries the full upload+process sequence once when the token expires (403)', async () => {
    mockedInitUpload
      .mockResolvedValueOnce({
        r2Key: 'users/1/rec-1.m4a',
        uploadUrl: 'https://r2.example.com/put-1',
        uploadToken: 'token-expired',
      })
      .mockResolvedValueOnce({
        r2Key: 'users/1/rec-2.m4a',
        uploadUrl: 'https://r2.example.com/put-2',
        uploadToken: 'token-fresh',
      });
    mockedUploadToR2.mockResolvedValue(undefined);
    mockedProcessMeeting
      .mockRejectedValueOnce(new MeetingUploadError('Token de upload expirado.', 403))
      .mockResolvedValueOnce({ meetingId: 'meeting-2' });

    const meetingId = await submitMeetingRecording({ fileInfo, meetingDate: '2026-07-23' });

    expect(meetingId).toBe('meeting-2');
    expect(mockedInitUpload).toHaveBeenCalledTimes(2);
    expect(mockedProcessMeeting).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-expiration errors', async () => {
    mockedInitUpload.mockResolvedValue({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-1',
    });
    mockedUploadToR2.mockResolvedValue(undefined);
    mockedProcessMeeting.mockRejectedValue(new MeetingUploadError('Data da reunião inválida.', 422));

    await expect(
      submitMeetingRecording({ fileInfo, meetingDate: 'invalid' })
    ).rejects.toThrow('Data da reunião inválida.');

    expect(mockedProcessMeeting).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 403 caused by an ownership mismatch', async () => {
    mockedInitUpload.mockResolvedValue({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-1',
    });
    mockedUploadToR2.mockResolvedValue(undefined);
    mockedProcessMeeting.mockRejectedValue(
      new MeetingUploadError('Upload não autorizado para este arquivo.', 403)
    );

    await expect(
      submitMeetingRecording({ fileInfo, meetingDate: '2026-07-23' })
    ).rejects.toThrow('Upload não autorizado para este arquivo.');

    expect(mockedProcessMeeting).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 403 caused by quota exceeded', async () => {
    mockedInitUpload.mockResolvedValue({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-1',
    });
    mockedUploadToR2.mockResolvedValue(undefined);
    mockedProcessMeeting.mockRejectedValue(
      new MeetingUploadError('Limite de reuniões do plano atingido.', 403)
    );

    await expect(
      submitMeetingRecording({ fileInfo, meetingDate: '2026-07-23' })
    ).rejects.toThrow('Limite de reuniões do plano atingido.');

    expect(mockedProcessMeeting).toHaveBeenCalledTimes(1);
  });

  it('gives up after the maximum number of attempts', async () => {
    mockedInitUpload.mockResolvedValue({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-1',
    });
    mockedUploadToR2.mockResolvedValue(undefined);
    mockedProcessMeeting.mockRejectedValue(new MeetingUploadError('Token de upload expirado.', 403));

    await expect(
      submitMeetingRecording({ fileInfo, meetingDate: '2026-07-23' })
    ).rejects.toThrow('Token de upload expirado.');

    expect(mockedProcessMeeting).toHaveBeenCalledTimes(3);
  }, 10000);
});

// ─── pollUntilTerminal ────────────────────────────────────────────────────────

describe('pollUntilTerminal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls until a completed status is reached, then stops automatically', async () => {
    mockedFetchMeetingStatus
      .mockResolvedValueOnce({
        id: 'meeting-1',
        title: 'Reunião',
        status: 'processing',
        processingStep: 'transcribe',
        jobStatus: null,
        errorMessage: null,
        taskCount: 0,
        decisionCount: 0,
      })
      .mockResolvedValueOnce({
        id: 'meeting-1',
        title: 'Reunião',
        status: 'completed',
        processingStep: 'cleanup',
        jobStatus: null,
        errorMessage: null,
        taskCount: 3,
        decisionCount: 1,
      });

    const onTick = jest.fn();
    pollUntilTerminal('meeting-1', onTick, 1000);

    await jest.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenNthCalledWith(1, {
      status: 'processing',
      stepIndex: 1,
      meta: { title: 'Reunião', taskCount: 0, decisionCount: 0 },
      errorMessage: null,
    });

    await jest.advanceTimersByTimeAsync(1000);
    expect(onTick).toHaveBeenNthCalledWith(2, {
      status: 'completed',
      stepIndex: 6,
      meta: { title: 'Reunião', taskCount: 3, decisionCount: 1 },
      errorMessage: null,
    });

    // Polling should have stopped itself after the terminal tick.
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockedFetchMeetingStatus).toHaveBeenCalledTimes(2);
  });

  it('stops polling when stop() is called manually', async () => {
    mockedFetchMeetingStatus.mockResolvedValue({
      id: 'meeting-1',
      title: null,
      status: 'processing',
      processingStep: null,
      jobStatus: null,
      errorMessage: null,
      taskCount: 0,
      decisionCount: 0,
    });

    const onTick = jest.fn();
    const stop = pollUntilTerminal('meeting-1', onTick, 1000);

    await jest.advanceTimersByTimeAsync(0);
    stop();

    await jest.advanceTimersByTimeAsync(5000);
    expect(mockedFetchMeetingStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through transient network errors', async () => {
    mockedFetchMeetingStatus
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        id: 'meeting-1',
        title: null,
        status: 'processing',
        processingStep: null,
        jobStatus: null,
        errorMessage: null,
        taskCount: 0,
        decisionCount: 0,
      });

    const onTick = jest.fn();
    pollUntilTerminal('meeting-1', onTick, 1000);

    await jest.advanceTimersByTimeAsync(0);
    expect(onTick).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
