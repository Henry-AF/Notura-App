// Exercises the real implementations of `initUpload`, `uploadToR2` and
// `processMeeting` (parsing, error mapping). Only the network edge
// (`fetchApi`) and the native upload task (`expo-file-system/legacy`) are
// mocked — see ARCHITECTURE.md Rule #7.

import { fetchApi } from '@/lib/api/client';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { initUpload, uploadToR2, processMeeting, MeetingUploadError } from './upload';

jest.mock('@/lib/api/client', () => ({
  fetchApi: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  createUploadTask: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 'BINARY_CONTENT' },
}));

const mockedFetchApi = fetchApi as jest.Mock;
const mockedCreateUploadTask = FileSystemLegacy.createUploadTask as jest.Mock;

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── initUpload ───────────────────────────────────────────────────────────────

describe('initUpload', () => {
  it('returns the presigned URL/token pair on success', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        r2Key: 'users/1/rec.m4a',
        uploadUrl: 'https://r2.example.com/put',
        uploadToken: 'token-abc',
      })
    );

    const result = await initUpload({
      fileName: 'notura-recording-1.m4a',
      contentType: 'audio/m4a',
      fileSize: 2048,
    });

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/meetings/upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: 'notura-recording-1.m4a',
        contentType: 'audio/m4a',
        fileSize: 2048,
      }),
    });
    expect(result).toEqual({
      r2Key: 'users/1/rec.m4a',
      uploadUrl: 'https://r2.example.com/put',
      uploadToken: 'token-abc',
    });
  });

  it('throws a MeetingUploadError with the real status/message on failure', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Não autorizado.' }, { ok: false, status: 401 })
    );

    await expect(
      initUpload({ fileName: 'a.m4a', contentType: 'audio/m4a', fileSize: 10 })
    ).rejects.toMatchObject({ message: 'Não autorizado.', status: 401 });
  });

  it('throws when the API response is missing required fields', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ r2Key: 'users/1/rec.m4a' }));

    await expect(
      initUpload({ fileName: 'a.m4a', contentType: 'audio/m4a', fileSize: 10 })
    ).rejects.toThrow('Resposta inválida do servidor ao iniciar upload.');
  });
});

// ─── uploadToR2 ───────────────────────────────────────────────────────────────

describe('uploadToR2', () => {
  it('reports progress and resolves on a 2xx upload result', async () => {
    let progressCallback: ((data: {
      totalBytesSent: number;
      totalBytesExpectedToSend: number;
    }) => void) | null = null;

    mockedCreateUploadTask.mockImplementation((_url, _uri, _opts, onProgress) => {
      progressCallback = onProgress;
      return {
        uploadAsync: jest.fn(async () => {
          progressCallback?.({ totalBytesSent: 50, totalBytesExpectedToSend: 100 });
          return { status: 200 };
        }),
      };
    });

    const onProgress = jest.fn();
    await uploadToR2('https://r2.example.com/put', 'file:///rec.m4a', 'audio/m4a', onProgress);

    expect(mockedCreateUploadTask).toHaveBeenCalledWith(
      'https://r2.example.com/put',
      'file:///rec.m4a',
      {
        httpMethod: 'PUT',
        uploadType: 'BINARY_CONTENT',
        headers: { 'Content-Type': 'audio/m4a' },
      },
      expect.any(Function)
    );
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('throws a MeetingUploadError when the upload result status is not 2xx', async () => {
    mockedCreateUploadTask.mockImplementation(() => ({
      uploadAsync: jest.fn(async () => ({ status: 403 })),
    }));

    await expect(
      uploadToR2('https://r2.example.com/put', 'file:///rec.m4a', 'audio/m4a')
    ).rejects.toMatchObject({
      message: 'Erro 403 ao enviar arquivo para storage.',
      status: 403,
    });
  });
});

// ─── processMeeting ───────────────────────────────────────────────────────────

describe('processMeeting', () => {
  const baseInput = {
    meetingDate: '2026-07-23',
    r2Key: 'users/1/rec.m4a',
    uploadToken: 'token-abc',
  };

  it('returns the meetingId on success', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ meetingId: 'meeting-1' }));

    const result = await processMeeting(baseInput);

    expect(result).toEqual({ meetingId: 'meeting-1' });
  });

  it('carries the exact "expired token" message from the backend', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Token de upload expirado.' }, { ok: false, status: 403 })
    );

    await expect(processMeeting(baseInput)).rejects.toMatchObject({
      message: 'Token de upload expirado.',
      status: 403,
    });
  });

  it('carries the exact "ownership mismatch" message from the backend', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Upload não autorizado para este arquivo.' }, { ok: false, status: 403 })
    );

    await expect(processMeeting(baseInput)).rejects.toMatchObject({
      message: 'Upload não autorizado para este arquivo.',
      status: 403,
    });
  });

  it('carries the exact quota-exceeded message from the backend', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Limite de reuniões do plano atingido.' }, { ok: false, status: 403 })
    );

    await expect(processMeeting(baseInput)).rejects.toMatchObject({
      message: 'Limite de reuniões do plano atingido.',
      status: 403,
    });
  });

  it('throws when the API response is missing meetingId', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({}));

    await expect(processMeeting(baseInput)).rejects.toThrow(
      'Resposta inválida do servidor ao criar reunião.'
    );
  });
});

describe('MeetingUploadError', () => {
  it('exposes the HTTP status alongside the message', () => {
    const error = new MeetingUploadError('Token de upload expirado.', 403);
    expect(error.message).toBe('Token de upload expirado.');
    expect(error.status).toBe(403);
    expect(error.name).toBe('MeetingUploadError');
  });
});
