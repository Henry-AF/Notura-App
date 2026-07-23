// Exercises the real `fetchMeetingStatus` implementation (mapping/error
// handling). Only the network edge (`fetchApi`) is mocked.

import { fetchApi } from '@/lib/api/client';
import { fetchMeetingStatus } from './status';

jest.mock('@/lib/api/client', () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = fetchApi as jest.Mock;

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

describe('fetchMeetingStatus', () => {
  it('maps the real /api/meetings/[id]/status payload shape', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        id: 'meeting-1',
        title: 'Reunião de Sprint',
        status: 'processing',
        processingStep: 'transcribe',
        jobStatus: 'running',
        errorMessage: null,
        taskCount: 2,
        decisionCount: 1,
      })
    );

    const result = await fetchMeetingStatus('meeting-1');

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/meetings/meeting-1/status');
    expect(result).toEqual({
      id: 'meeting-1',
      title: 'Reunião de Sprint',
      status: 'processing',
      processingStep: 'transcribe',
      jobStatus: 'running',
      errorMessage: null,
      taskCount: 2,
      decisionCount: 1,
    });
  });

  it('normalizes an unrecognized status string to "processing"', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        id: 'meeting-1',
        title: null,
        status: 'queued',
        processingStep: null,
        jobStatus: null,
        errorMessage: null,
        taskCount: 0,
        decisionCount: 0,
      })
    );

    const result = await fetchMeetingStatus('meeting-1');
    expect(result.status).toBe('processing');
  });

  it('defaults taskCount/decisionCount to 0 when absent', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        id: 'meeting-1',
        title: null,
        status: 'pending',
        processingStep: null,
        jobStatus: null,
        errorMessage: null,
      })
    );

    const result = await fetchMeetingStatus('meeting-1');
    expect(result.taskCount).toBe(0);
    expect(result.decisionCount).toBe(0);
  });

  it('throws the real API error message on a non-ok response', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Reunião não encontrada.' }, { ok: false, status: 404 })
    );

    await expect(fetchMeetingStatus('missing-id')).rejects.toThrow('Reunião não encontrada.');
  });

  it('throws a fallback message when the ok response is missing required fields', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({}));

    await expect(fetchMeetingStatus('meeting-1')).rejects.toThrow(
      'Erro ao carregar status da reunião.'
    );
  });
});
