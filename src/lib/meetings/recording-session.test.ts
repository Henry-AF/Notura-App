import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RemoteDisplayAudioMissingError,
  createMicrophoneRecordingCapture,
  createRemoteMeetingRecordingCapture,
  formatRecordingDuration,
  getPreferredRecordingMimeType,
} from "./recording-session";

interface FakeTrack {
  id: string;
  stop: ReturnType<typeof vi.fn>;
}

interface FakeStream {
  getAudioTracks: ReturnType<typeof vi.fn>;
  getVideoTracks: ReturnType<typeof vi.fn>;
  getTracks: ReturnType<typeof vi.fn>;
}

function createTrack(id: string): FakeTrack {
  return { id, stop: vi.fn() };
}

function createStream(audioTracks: FakeTrack[], videoTracks: FakeTrack[] = []): FakeStream {
  const tracks = [...audioTracks, ...videoTracks];

  return {
    getAudioTracks: vi.fn(() => audioTracks),
    getVideoTracks: vi.fn(() => videoTracks),
    getTracks: vi.fn(() => tracks),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recording session helpers", () => {
  it("prefers mp4-compatible mime types before webm fallbacks", () => {
    const supports = vi.fn((mimeType: string) => mimeType === "video/mp4");

    expect(getPreferredRecordingMimeType(supports)).toBe("video/mp4");
    expect(supports).toHaveBeenNthCalledWith(1, "audio/mp4");
    expect(supports).toHaveBeenNthCalledWith(2, "video/mp4");
  });

  it("formats elapsed recording time in a compact clock format", () => {
    expect(formatRecordingDuration(9)).toBe("00:09");
    expect(formatRecordingDuration(125)).toBe("02:05");
    expect(formatRecordingDuration(3723)).toBe("01:02:03");
  });

  it("creates a microphone recording capture that can clean up its stream", async () => {
    const microphoneTrack = createTrack("microphone-audio");
    const microphoneStream = createStream([microphoneTrack]);
    const getUserMedia = vi.fn().mockResolvedValue(microphoneStream);

    const capture = await createMicrophoneRecordingCapture({
      mediaDevices: { getUserMedia },
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(capture.stream).toBe(microphoneStream);

    capture.cleanup();
    capture.cleanup();

    expect(microphoneTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("does not require display capture support for microphone recording", async () => {
    const microphoneTrack = createTrack("microphone-audio");
    const microphoneStream = createStream([microphoneTrack]);
    const getUserMedia = vi.fn().mockResolvedValue(microphoneStream);

    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
    });

    const capture = await createMicrophoneRecordingCapture();

    expect(capture.stream).toBe(microphoneStream);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  });

  it("blocks remote meeting recording when shared display audio is missing", async () => {
    const displayVideoTrack = createTrack("display-video");
    const displayStream = createStream([], [displayVideoTrack]);
    const getDisplayMedia = vi.fn().mockResolvedValue(displayStream);
    const getUserMedia = vi.fn();

    await expect(
      createRemoteMeetingRecordingCapture({
        mediaDevices: { getDisplayMedia, getUserMedia },
        createAudioContext: vi.fn(),
        createMediaStream: vi.fn(),
      })
    ).rejects.toBeInstanceOf(RemoteDisplayAudioMissingError);

    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: { suppressLocalAudioPlayback: false },
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "include",
      windowAudio: "system",
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(displayVideoTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("mixes shared display audio with microphone audio in one recording stream", async () => {
    const displayAudioTrack = createTrack("display-audio");
    const displayVideoTrack = createTrack("display-video");
    const microphoneTrack = createTrack("microphone-audio");
    const mixedAudioTrack = createTrack("mixed-audio");
    const displayStream = createStream([displayAudioTrack], [displayVideoTrack]);
    const microphoneStream = createStream([microphoneTrack]);
    const destinationStream = createStream([mixedAudioTrack]);
    const combinedStream = createStream([mixedAudioTrack]);
    const displaySource = { connect: vi.fn() };
    const microphoneSource = { connect: vi.fn() };
    const destination = { stream: destinationStream };
    const audioContext = {
      createMediaStreamDestination: vi.fn(() => destination),
      createMediaStreamSource: vi
        .fn()
        .mockReturnValueOnce(displaySource)
        .mockReturnValueOnce(microphoneSource),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const createMediaStream = vi.fn(() => combinedStream);

    const capture = await createRemoteMeetingRecordingCapture({
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(displayStream),
        getUserMedia: vi.fn().mockResolvedValue(microphoneStream),
      },
      createAudioContext: vi.fn(() => audioContext),
      createMediaStream,
    });

    expect(audioContext.createMediaStreamSource).toHaveBeenNthCalledWith(
      1,
      displayStream
    );
    expect(audioContext.createMediaStreamSource).toHaveBeenNthCalledWith(
      2,
      microphoneStream
    );
    expect(displaySource.connect).toHaveBeenCalledWith(destination);
    expect(microphoneSource.connect).toHaveBeenCalledWith(destination);
    expect(createMediaStream).toHaveBeenCalledWith([mixedAudioTrack]);
    expect(capture.stream).toBe(combinedStream);
    expect(displayVideoTrack.stop).toHaveBeenCalledTimes(1);

    capture.cleanup();

    expect(displayAudioTrack.stop).toHaveBeenCalledTimes(1);
    expect(displayVideoTrack.stop).toHaveBeenCalledTimes(1);
    expect(microphoneTrack.stop).toHaveBeenCalledTimes(1);
    expect(mixedAudioTrack.stop).toHaveBeenCalledTimes(1);
    expect(audioContext.close).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended audio context before mixing remote audio", async () => {
    const displayAudioTrack = createTrack("display-audio");
    const microphoneTrack = createTrack("microphone-audio");
    const mixedAudioTrack = createTrack("mixed-audio");
    const displayStream = createStream([displayAudioTrack]);
    const microphoneStream = createStream([microphoneTrack]);
    const destinationStream = createStream([mixedAudioTrack]);
    const combinedStream = createStream([mixedAudioTrack]);
    const displaySource = { connect: vi.fn() };
    const microphoneSource = { connect: vi.fn() };
    const destination = { stream: destinationStream };
    const resume = vi.fn().mockResolvedValue(undefined);
    const createMediaStreamSource = vi
      .fn()
      .mockReturnValueOnce(displaySource)
      .mockReturnValueOnce(microphoneSource);
    const audioContext = {
      state: "suspended",
      resume,
      createMediaStreamDestination: vi.fn(() => destination),
      createMediaStreamSource,
      close: vi.fn().mockResolvedValue(undefined),
    };

    await createRemoteMeetingRecordingCapture({
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(displayStream),
        getUserMedia: vi.fn().mockResolvedValue(microphoneStream),
      },
      createAudioContext: vi.fn(() => audioContext),
      createMediaStream: vi.fn(() => combinedStream),
    });

    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume.mock.invocationCallOrder[0]).toBeLessThan(
      createMediaStreamSource.mock.invocationCallOrder[0]
    );
  });
});
