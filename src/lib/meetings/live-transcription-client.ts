import { StreamingTranscriber } from "assemblyai";
import type { TurnEvent } from "assemblyai";

// Draft transcript shown as visual feedback while recording — imperfect and
// throwaway on purpose. The final transcript keeps coming from the existing
// batch flow (upload → AssemblyAI batch → ata) and is never touched here.
const LIVE_TRANSCRIPTION_SAMPLE_RATE = 16_000;
const PCM_PROCESSOR_BUFFER_SIZE = 2048;
const STREAMING_TOKEN_ENDPOINT = "/api/assemblyai/token";

export interface LiveTranscriptionCallbacks {
  onPartialTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onUnavailable: () => void;
}

export interface LiveTranscriptionSession {
  stop: () => void;
}

interface StreamingTranscriberLike {
  on(event: "turn", listener: (event: TurnEvent) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close", listener: (code: number, reason: string) => void): void;
  connect(): Promise<unknown>;
  sendAudio(audio: ArrayBufferLike): void;
  close(waitForSessionTermination?: boolean): Promise<void>;
}

type LiveAudioContext = Pick<
  AudioContext,
  "createMediaStreamSource" | "createScriptProcessor" | "createGain" | "close" | "destination"
>;

export interface LiveTranscriptionDependencies {
  fetchStreamingToken?: () => Promise<string>;
  createTranscriber?: (token: string) => StreamingTranscriberLike;
  createAudioContext?: () => LiveAudioContext;
}

interface AudioPipeline {
  audioContext: LiveAudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
}

/**
 * Starts a best-effort live transcription session in parallel with the
 * MediaRecorder capture. Every failure path (missing token, connection
 * error, unsupported browser) resolves into `onUnavailable()` instead of
 * throwing — the caller's recording must never be affected by this stream.
 */
export async function startLiveTranscription(
  stream: MediaStream,
  callbacks: LiveTranscriptionCallbacks,
  dependencies: LiveTranscriptionDependencies = {}
): Promise<LiveTranscriptionSession> {
  const fetchToken = dependencies.fetchStreamingToken ?? fetchStreamingToken;
  const createTranscriber = dependencies.createTranscriber ?? createDefaultTranscriber;
  const createAudioContext = dependencies.createAudioContext ?? createBrowserAudioContext;

  let pipeline: AudioPipeline | null = null;
  let transcriber: StreamingTranscriberLike | null = null;
  let hasStopped = false;

  const stop = (): void => {
    if (hasStopped) return;
    hasStopped = true;

    disposeAudioPipeline(pipeline);
    pipeline = null;
    void transcriber?.close(false);
    transcriber = null;
  };

  try {
    const token = await fetchToken();
    const activeTranscriber = createTranscriber(token);
    transcriber = activeTranscriber;

    activeTranscriber.on("turn", (turn) => {
      if (turn.end_of_turn) {
        callbacks.onFinalTranscript(turn.transcript);
      } else {
        callbacks.onPartialTranscript(turn.transcript);
      }
    });

    activeTranscriber.on("error", (error) => {
      console.warn("[live-transcription] stream error:", error);
    });

    activeTranscriber.on("close", () => {
      if (hasStopped) return;
      stop();
      callbacks.onUnavailable();
    });

    await activeTranscriber.connect();

    pipeline = createAudioPipeline(stream, createAudioContext, (chunk) => {
      activeTranscriber.sendAudio(chunk);
    });

    return { stop };
  } catch (error) {
    console.warn("[live-transcription] unavailable:", error);
    stop();
    callbacks.onUnavailable();
    return { stop: noop };
  }
}

function noop(): void {}

async function fetchStreamingToken(): Promise<string> {
  const response = await fetch(STREAMING_TOKEN_ENDPOINT, { method: "POST" });

  if (!response.ok) {
    throw new Error("Não foi possível obter o token de transcrição ao vivo.");
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

function createDefaultTranscriber(token: string): StreamingTranscriberLike {
  return new StreamingTranscriber({
    token,
    sampleRate: LIVE_TRANSCRIPTION_SAMPLE_RATE,
    encoding: "pcm_s16le",
    speechModel: "universal-streaming-multilingual",
  });
}

function createAudioPipeline(
  stream: MediaStream,
  createAudioContext: () => LiveAudioContext,
  onPcmChunk: (chunk: ArrayBuffer) => void
): AudioPipeline {
  const audioContext = createAudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(PCM_PROCESSOR_BUFFER_SIZE, 1, 1);
  const silence = audioContext.createGain();

  // ScriptProcessorNode only fires `audioprocess` while connected to a
  // destination; route through a muted gain node so nothing plays back.
  silence.gain.value = 0;
  processor.onaudioprocess = (event) => {
    onPcmChunk(encodePcm16(event.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(silence);
  silence.connect(audioContext.destination);

  return { audioContext, source, processor };
}

function disposeAudioPipeline(pipeline: AudioPipeline | null): void {
  if (!pipeline) return;

  pipeline.processor.onaudioprocess = null;
  pipeline.source.disconnect();
  pipeline.processor.disconnect();
  void pipeline.audioContext.close();
}

export function encodePcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return buffer;
}

function createBrowserAudioContext(): LiveAudioContext {
  if (typeof window === "undefined") {
    throw new Error("Seu navegador não suporta transcrição ao vivo nesta página.");
  }

  const browserWindow = window as Omit<Window, "AudioContext"> & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("Seu navegador não suporta transcrição ao vivo nesta página.");
  }

  return new AudioContextConstructor({ sampleRate: LIVE_TRANSCRIPTION_SAMPLE_RATE });
}
