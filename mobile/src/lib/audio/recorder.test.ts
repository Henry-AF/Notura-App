// NOT-138 regression lock: `shouldPlayInBackground` is easy to drop again
// during a refactor because `allowsBackgroundRecording` reads as if it
// already covers this — it doesn't (see `recorder.ts`). Only `expo-audio`
// (the external lib boundary — Rule #7) is mocked.

import { setAudioModeAsync } from 'expo-audio';
import { activateRecordingAudioMode, deactivateRecordingAudioMode } from './recorder';

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(),
}));

const mockedSetAudioModeAsync = setAudioModeAsync as jest.Mock;

describe('activateRecordingAudioMode', () => {
  beforeEach(() => {
    mockedSetAudioModeAsync.mockClear();
  });

  it('enables shouldPlayInBackground alongside allowsBackgroundRecording', async () => {
    await activateRecordingAudioMode();

    expect(mockedSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsBackgroundRecording: true,
        shouldPlayInBackground: true,
      })
    );
  });

  it('enables recording and silent-mode playback', async () => {
    await activateRecordingAudioMode();

    expect(mockedSetAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsRecording: true,
        playsInSilentMode: true,
      })
    );
  });
});

describe('deactivateRecordingAudioMode', () => {
  it('disables recording', async () => {
    mockedSetAudioModeAsync.mockClear();

    await deactivateRecordingAudioMode();

    expect(mockedSetAudioModeAsync).toHaveBeenCalledWith({ allowsRecording: false });
  });
});
