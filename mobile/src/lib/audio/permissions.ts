// Thin wrapper over `expo-audio`'s microphone permission API (Rule #7 — reusable
// logic that touches an external library must live in lib/, not scattered across
// components).

import * as Linking from 'expo-linking';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  type PermissionResponse,
} from 'expo-audio';

export type MicrophonePermissionState = 'granted' | 'denied' | 'undetermined';

function mapPermissionResponse(response: PermissionResponse): MicrophonePermissionState {
  if (response.status === 'granted') return 'granted';
  if (response.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function checkMicrophonePermission(): Promise<MicrophonePermissionState> {
  const response = await getRecordingPermissionsAsync();
  return mapPermissionResponse(response);
}

export async function requestMicrophonePermission(): Promise<MicrophonePermissionState> {
  const response = await requestRecordingPermissionsAsync();
  return mapPermissionResponse(response);
}

// iOS/Android both stop offering a permission dialog once the user has denied
// it once (canAskAgain: false). At that point the only way forward is Settings.
export async function openMicrophoneSettings(): Promise<void> {
  await Linking.openSettings();
}
