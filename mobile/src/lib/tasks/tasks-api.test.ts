import { fetchApi } from '@/lib/api/client';
import { createTask, deleteTask, fetchTaskBoard, updateTask } from './tasks-api';

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

function buildApiTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task-1',
    title: 'Enviar proposta',
    priority: 'alta',
    columnId: 'todo',
    meetingId: 'meeting-1',
    meetingSource: 'Cliente X',
    dueDate: '2026-08-01',
    assignee: { name: 'Henry' },
    generatedByAI: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchTaskBoard', () => {
  it('flattens the column-grouped response into a plain task list', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        columns: [
          { id: 'todo', tasks: [buildApiTask()] },
          { id: 'in_progress', tasks: [] },
          { id: 'completed', tasks: [buildApiTask({ id: 'task-2', columnId: 'completed' })] },
        ],
        meetings: [{ id: 'meeting-1', title: 'Reunião X', clientName: 'Cliente X', label: 'Cliente X - Reunião X' }],
      })
    );

    const board = await fetchTaskBoard();

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/tasks');
    expect(board.tasks).toHaveLength(2);
    expect(board.tasks[0]).toMatchObject({ id: 'task-1', status: 'todo', ownerName: 'Henry' });
    expect(board.tasks[1]).toMatchObject({ id: 'task-2', status: 'completed' });
    expect(board.meetings).toHaveLength(1);
  });

  it('builds a query string from meetingId/groupId filters', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ columns: [], meetings: [] }));

    await fetchTaskBoard({ meetingId: 'meeting-1', groupId: 'group-1' });

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/tasks?meetingId=meeting-1&groupId=group-1');
  });

  it('throws with the API error message on failure', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Erro ao buscar tarefas.' }, { ok: false, status: 500 })
    );

    await expect(fetchTaskBoard()).rejects.toThrow('Erro ao buscar tarefas.');
  });
});

describe('createTask', () => {
  it('sends the description/meeting_id contract and maps the response', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ task: buildApiTask() }, { status: 201 }));

    const task = await createTask({ title: 'Enviar proposta', meetingId: 'meeting-1', priority: 'alta' });

    expect(mockedFetchApi).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          description: 'Enviar proposta',
          meeting_id: 'meeting-1',
          priority: 'alta',
          status: undefined,
          due_date: undefined,
          owner: undefined,
        }),
      })
    );
    expect(task.id).toBe('task-1');
  });

  it('throws with the API error message on failure', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Campo obrigatório.' }, { ok: false, status: 400 })
    );

    await expect(createTask({ title: '', meetingId: '' })).rejects.toThrow('Campo obrigatório.');
  });
});

describe('updateTask', () => {
  it('PATCHes only the fields the web API accepts', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ task: buildApiTask({ columnId: 'in_progress' }) })
    );

    const task = await updateTask('task-1', { status: 'in_progress' });

    expect(mockedFetchApi).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(task.status).toBe('in_progress');
  });
});

describe('deleteTask', () => {
  it('resolves when the API confirms success', async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ success: true }));

    await expect(deleteTask('task-1')).resolves.toBeUndefined();
    expect(mockedFetchApi).toHaveBeenCalledWith('/api/tasks/task-1', { method: 'DELETE' });
  });

  it('throws with the API error message on failure', async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: 'Erro ao deletar tarefa.' }, { ok: false, status: 500 })
    );

    await expect(deleteTask('task-1')).rejects.toThrow('Erro ao deletar tarefa.');
  });
});
