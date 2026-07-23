// Exercises the real persistence functions. Only `expo-secure-store` (the
// external lib boundary — Rule #7) is mocked.

import * as SecureStore from 'expo-secure-store';
import {
  savePendingRecording,
  loadPendingRecording,
  clearPendingRecording,
  type PendingRecording,
} from './recording-recovery';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockedSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

const STORAGE_KEY = 'notura.pending-recording';

const pending: PendingRecording = {
  uri: 'file:///rec.m4a',
  fileSize: 4096,
  contentType: 'audio/m4a',
  durationMs: 60000,
  meetingDate: '2026-07-23',
  savedAt: 1753315200000,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('savePendingRecording', () => {
  it('persists the recording as JSON under the fixed storage key', async () => {
    mockedSetItemAsync.mockResolvedValueOnce(undefined);

    await savePendingRecording(pending);

    expect(mockedSetItemAsync).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(pending));
  });
});

describe('loadPendingRecording', () => {
  it('returns null when nothing is stored', async () => {
    mockedGetItemAsync.mockResolvedValueOnce(null);

    const result = await loadPendingRecording();

    expect(mockedGetItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
    expect(result).toBeNull();
  });

  it('returns the parsed value that was previously saved', async () => {
    mockedGetItemAsync.mockResolvedValueOnce(JSON.stringify(pending));

    const result = await loadPendingRecording();

    expect(result).toEqual(pending);
  });

  it('returns null without throwing when the stored value is corrupted JSON', async () => {
    mockedGetItemAsync.mockResolvedValueOnce('{not-valid-json');

    await expect(loadPendingRecording()).resolves.toBeNull();
  });
});

describe('clearPendingRecording', () => {
  it('deletes the stored value under the fixed storage key', async () => {
    mockedDeleteItemAsync.mockResolvedValueOnce(undefined);

    await clearPendingRecording();

    expect(mockedDeleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('leaves loadPendingRecording returning null after clearing', async () => {
    mockedDeleteItemAsync.mockResolvedValueOnce(undefined);
    mockedGetItemAsync.mockResolvedValueOnce(null);

    await clearPendingRecording();
    const result = await loadPendingRecording();

    expect(result).toBeNull();
  });
});
