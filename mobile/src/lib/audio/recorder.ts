// Thin wrapper over `expo-audio` recording configuration and `expo-file-system`
// file metadata. The `AudioRecorder` instance itself must be created with the
// `useAudioRecorder` hook (expo-audio manages its lifecycle as a
// React-released SharedObject), so it is created in `record.tsx`. Everything
// that does NOT need to be a hook — audio mode, recording options, content
// type, file size/cleanup — is centralized here so the component stays UI-only.

import { File } from 'expo-file-system';
import { RecordingPresets, setAudioModeAsync, type RecordingOptions } from 'expo-audio';

// expo-audio's HIGH_QUALITY preset records `.m4a` (AAC) on iOS and Android,
// which is what the backend upload/process routes expect (contentType must
// start with "audio/").
export const RECORDING_CONTENT_TYPE = 'audio/m4a';

export function getRecordingOptions(): RecordingOptions {
  return RecordingPresets.HIGH_QUALITY;
}

// Configures the audio session for recording, including background audio on
// iOS (requires `UIBackgroundModes: ["audio"]` in app.json — see 6.2 in the
// spec for Android limitations).
export async function activateRecordingAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    allowsBackgroundRecording: true,
    interruptionMode: 'doNotMix',
  });
}

export async function deactivateRecordingAudioMode(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false });
}

export function buildRecordingFileName(now: Date = new Date()): string {
  return `notura-recording-${now.getTime()}.m4a`;
}

export interface RecordingFileInfo {
  uri: string;
  fileSize: number;
  contentType: string;
}

// The backend validates that the uploaded object's real size in R2 matches
// the `fileSize` sent to /api/meetings/upload — it must never be estimated.
export function getRecordingFileInfo(uri: string): RecordingFileInfo {
  const file = new File(uri);
  return { uri, fileSize: file.size, contentType: RECORDING_CONTENT_TYPE };
}

export function deleteRecordingFile(uri: string): void {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}
