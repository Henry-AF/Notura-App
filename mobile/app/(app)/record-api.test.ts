import { fetchApi } from '@/lib/api/client';
import { initUpload, uploadToR2, processMeeting, MeetingUploadError } from '@/lib/meetings/upload';
import { buildRecordingFileName } from '@/lib/audio/recorder';
import {
  resolveWhatsappGate,
  fetchAccountWhatsappDefaults,
  getTodayDateStringUtc,
  startMeetingUpload,
  runProcess,
  submitMeetingRecording,
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

beforeEach(() => {
  jest.clearAllMocks();
  (buildRecordingFileName as jest.Mock).mockReturnValue('notura-recording-123.m4a');
});

// ─── mapStatusToStep ──────────────────────────────────────────────────────────

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

describe('processing polling ownership', () => {
  it('does not expose polling from the recording companion', () => {
    const recordApi = jest.requireActual('./record-api') as Record<string, unknown>;
    expect(recordApi.pollUntilTerminal).toBeUndefined();
  });
});
