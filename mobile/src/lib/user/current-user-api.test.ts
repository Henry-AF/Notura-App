import { fetchApi } from '@/lib/api/client';
import { fetchCurrentUserName } from './current-user-api';

jest.mock('@/lib/api/client', () => ({
  fetchApi: jest.fn(),
}));

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

const mockedFetchApi = fetchApi as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchCurrentUserName', () => {
  it('returns the trimmed name from the API', async () => {
    mockedFetchApi.mockResolvedValue(mockResponse({ user: { name: '  Henry  ' } }));
    expect(await fetchCurrentUserName()).toBe('Henry');
  });

  it('falls back to a generic greeting when the name is empty', async () => {
    mockedFetchApi.mockResolvedValue(mockResponse({ user: { name: '' } }));
    expect(await fetchCurrentUserName()).toBe('você');
  });

  it('throws with the backend error message on failure', async () => {
    mockedFetchApi.mockResolvedValue(
      mockResponse({ error: 'Não autenticado.' }, { ok: false, status: 401 })
    );
    await expect(fetchCurrentUserName()).rejects.toThrow('Não autenticado.');
  });
});
