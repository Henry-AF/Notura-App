// Persists metadata about an in-progress recording/upload so that if the app
// is killed (low battery, OS memory pressure, user swipe-close) the user is
// offered a chance to resume the upload instead of losing the recorded audio.
// Wraps `expo-secure-store` (Rule #7 — external lib access lives in lib/).

import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'notura.pending-recording';

export interface PendingRecording {
  uri: string;
  fileSize: number;
  contentType: string;
  durationMs: number;
  meetingDate: string;
  savedAt: number;
}

export async function savePendingRecording(pending: PendingRecording): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(pending));
}

export async function loadPendingRecording(): Promise<PendingRecording | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingRecording;
  } catch {
    return null;
  }
}

export async function clearPendingRecording(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
