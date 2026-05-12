const RECORDING_MIME_CANDIDATES = [
  "audio/mp4",
  "video/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
] as const;

type DisplayAudioSharingOption = "include" | "exclude";
type WindowAudioSharingOption = "exclude" | "window" | "system";

interface RemoteDisplayAudioConstraints extends MediaTrackConstraints {
  suppressLocalAudioPlayback: boolean;
}

interface RemoteDisplayMediaOptions
  extends Omit<DisplayMediaStreamOptions, "audio"> {
  audio: RemoteDisplayAudioConstraints;
  preferCurrentTab: boolean;
  selfBrowserSurface: DisplayAudioSharingOption;
  surfaceSwitching: DisplayAudioSharingOption;
  systemAudio: DisplayAudioSharingOption;
  windowAudio: WindowAudioSharingOption;
}

type RemoteCaptureMediaDevices = Pick<
  MediaDevices,
  "getDisplayMedia" | "getUserMedia"
>;
type MicrophoneCaptureMediaDevices = Pick<MediaDevices, "getUserMedia">;

type RemoteCaptureAudioContext = Pick<
  AudioContext,
  "close" | "createMediaStreamDestination" | "createMediaStreamSource"
>;

interface RemoteMeetingRecordingCaptureDependencies {
  mediaDevices?: RemoteCaptureMediaDevices;
  createAudioContext?: () => RemoteCaptureAudioContext;
  createMediaStream?: (tracks: MediaStreamTrack[]) => MediaStream;
}

interface MicrophoneRecordingCaptureDependencies {
  mediaDevices?: MicrophoneCaptureMediaDevices;
}

export interface MeetingRecordingCapture {
  stream: MediaStream;
  cleanup: () => void;
}

export class RemoteDisplayAudioMissingError extends Error {
  constructor() {
    super(
      "Selecione uma aba, janela ou tela com compartilhamento de áudio habilitado."
    );
    this.name = "RemoteDisplayAudioMissingError";
  }
}

export function getPreferredRecordingMimeType(
  supportsMimeType: (mimeType: string) => boolean
): string {
  for (const mimeType of RECORDING_MIME_CANDIDATES) {
    if (supportsMimeType(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

export function formatRecordingDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

export function getRemoteDisplayMediaOptions(): RemoteDisplayMediaOptions {
  return {
    video: true,
    audio: {
      suppressLocalAudioPlayback: false,
    } satisfies RemoteDisplayAudioConstraints,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: "include",
    windowAudio: "system",
  };
}

export async function createMicrophoneRecordingCapture(
  dependencies: MicrophoneRecordingCaptureDependencies = {}
): Promise<MeetingRecordingCapture> {
  const mediaDevices =
    dependencies.mediaDevices ?? getBrowserMicrophoneMediaDevices();
  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });

  return {
    stream,
    cleanup: createStreamCleanup(stream),
  };
}

export async function createRemoteMeetingRecordingCapture(
  dependencies: RemoteMeetingRecordingCaptureDependencies = {}
): Promise<MeetingRecordingCapture> {
  const mediaDevices = dependencies.mediaDevices ?? getBrowserRemoteMediaDevices();
  const displayStream = await mediaDevices.getDisplayMedia(
    getRemoteDisplayMediaOptions()
  );

  if (displayStream.getAudioTracks().length === 0) {
    stopStreamTracks(displayStream);
    throw new RemoteDisplayAudioMissingError();
  }

  stopVideoTracks(displayStream);

  let microphoneStream: MediaStream | null = null;
  let audioContext: RemoteCaptureAudioContext | null = null;

  try {
    microphoneStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    audioContext = (dependencies.createAudioContext ?? createBrowserAudioContext)();
    const destination = audioContext.createMediaStreamDestination();

    audioContext.createMediaStreamSource(displayStream).connect(destination);
    audioContext.createMediaStreamSource(microphoneStream).connect(destination);

    const createMediaStream =
      dependencies.createMediaStream ??
      ((tracks: MediaStreamTrack[]) => new MediaStream(tracks));
    const recordingStream = createMediaStream(destination.stream.getAudioTracks());

    return {
      stream: recordingStream,
      cleanup: createRemoteCaptureCleanup({
        audioContext,
        displayStream,
        microphoneStream,
        recordingStream,
      }),
    };
  } catch (error) {
    stopAudioTracks(displayStream);
    if (microphoneStream) {
      stopStreamTracks(microphoneStream);
    }
    if (audioContext) {
      void audioContext.close();
    }
    throw error;
  }
}

function createRemoteCaptureCleanup({
  audioContext,
  displayStream,
  microphoneStream,
  recordingStream,
}: {
  audioContext: RemoteCaptureAudioContext;
  displayStream: MediaStream;
  microphoneStream: MediaStream;
  recordingStream: MediaStream;
}): () => void {
  let hasCleanedUp = false;

  return () => {
    if (hasCleanedUp) {
      return;
    }

    hasCleanedUp = true;
    stopAudioTracks(displayStream);
    stopStreamTracks(microphoneStream);
    stopStreamTracks(recordingStream);
    void audioContext.close();
  };
}

function createStreamCleanup(stream: MediaStream): () => void {
  let hasCleanedUp = false;

  return () => {
    if (hasCleanedUp) {
      return;
    }

    hasCleanedUp = true;
    stopStreamTracks(stream);
  };
}

function stopStreamTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function stopAudioTracks(stream: MediaStream): void {
  stream.getAudioTracks().forEach((track) => track.stop());
}

function stopVideoTracks(stream: MediaStream): void {
  stream.getVideoTracks().forEach((track) => track.stop());
}

function getBrowserMicrophoneMediaDevices(): MicrophoneCaptureMediaDevices {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error("Seu navegador não suporta gravação de áudio nesta página.");
  }

  return navigator.mediaDevices;
}

function getBrowserRemoteMediaDevices(): RemoteCaptureMediaDevices {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new Error("Seu navegador não suporta gravação remota nesta página.");
  }

  return navigator.mediaDevices;
}

function createBrowserAudioContext(): RemoteCaptureAudioContext {
  if (typeof window === "undefined") {
    throw new Error("Seu navegador não suporta mixagem de áudio nesta página.");
  }

  const browserWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    window.AudioContext ?? browserWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("Seu navegador não suporta mixagem de áudio nesta página.");
  }

  return new AudioContextConstructor();
}
