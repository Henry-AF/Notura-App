import { describe, expect, it, vi } from "vitest";
import {
  encodePcm16,
  startLiveTranscription,
  type LiveTranscriptionCallbacks,
} from "./live-transcription-client";

// ── encodePcm16 ────────────────────────────────────────────────────────────────

function readInt16(buffer: ArrayBuffer, index: number): number {
  return new DataView(buffer).getInt16(index * 2, true);
}

describe("encodePcm16", () => {
  it("encodes silence as zero", () => {
    const buffer = encodePcm16(new Float32Array([0]));
    expect(readInt16(buffer, 0)).toBe(0);
  });

  it("encodes full-scale positive and negative samples", () => {
    const buffer = encodePcm16(new Float32Array([1, -1]));
    expect(readInt16(buffer, 0)).toBe(0x7fff);
    expect(readInt16(buffer, 1)).toBe(-0x8000);
  });

  it("clamps samples outside [-1, 1]", () => {
    const buffer = encodePcm16(new Float32Array([2, -2]));
    expect(readInt16(buffer, 0)).toBe(0x7fff);
    expect(readInt16(buffer, 1)).toBe(-0x8000);
  });

  it("produces a buffer with two bytes per sample", () => {
    const buffer = encodePcm16(new Float32Array([0, 0.1, -0.1, 0.5]));
    expect(buffer.byteLength).toBe(8);
  });
});

// ── startLiveTranscription ──────────────────────────────────────────────────────

interface FakeTranscriber {
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  sendAudio: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
}

function createFakeTranscriber(
  connectResult: Promise<unknown> = Promise.resolve({ type: "Begin" })
): FakeTranscriber {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  return {
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    }),
    connect: vi.fn(() => connectResult),
    sendAudio: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    emit: (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
  };
}

interface FakeAudioContext {
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createScriptProcessor: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  destination: AudioDestinationNode;
}

function createFakeAudioContext() {
  const processor: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onaudioprocess: ((event: unknown) => void) | null;
  } = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const gain = { gain: { value: 1 }, connect: vi.fn() };
  const context: FakeAudioContext = {
    createMediaStreamSource: vi.fn(() => source),
    createScriptProcessor: vi.fn(() => processor),
    createGain: vi.fn(() => gain),
    close: vi.fn().mockResolvedValue(undefined),
    destination: {} as AudioDestinationNode,
  };

  return { context, processor, source, gain };
}

function createCallbacks(): LiveTranscriptionCallbacks & {
  onPartialTranscript: ReturnType<typeof vi.fn>;
  onFinalTranscript: ReturnType<typeof vi.fn>;
  onUnavailable: ReturnType<typeof vi.fn>;
} {
  return {
    onPartialTranscript: vi.fn(),
    onFinalTranscript: vi.fn(),
    onUnavailable: vi.fn(),
  };
}

describe("startLiveTranscription audio pipeline", () => {
  it("mutes the gain node so the mic never plays back through speakers", async () => {
    const transcriber = createFakeTranscriber();
    const { context, gain } = createFakeAudioContext();
    const callbacks = createCallbacks();

    await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockResolvedValue("token-123"),
      createTranscriber: () => transcriber,
      createAudioContext: () => context,
    });

    expect(gain.gain.value).toBe(0);
  });

  it("streams encoded PCM16 audio frames to the transcriber", async () => {
    const transcriber = createFakeTranscriber();
    const { context, processor } = createFakeAudioContext();
    const callbacks = createCallbacks();

    await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockResolvedValue("token-123"),
      createTranscriber: () => transcriber,
      createAudioContext: () => context,
    });

    const samples = new Float32Array([0, 1, -1]);
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => samples },
    });

    expect(transcriber.sendAudio).toHaveBeenCalledTimes(1);
    const sentChunk = transcriber.sendAudio.mock.calls[0][0] as ArrayBuffer;
    expect(sentChunk).toEqual(encodePcm16(samples));
  });
});

describe("startLiveTranscription turn events", () => {
  it("forwards partial and final turns to the matching callbacks", async () => {
    const transcriber = createFakeTranscriber();
    const { context } = createFakeAudioContext();
    const callbacks = createCallbacks();

    await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockResolvedValue("token-123"),
      createTranscriber: () => transcriber,
      createAudioContext: () => context,
    });

    transcriber.emit("turn", { end_of_turn: false, transcript: "oi pes" });
    transcriber.emit("turn", { end_of_turn: true, transcript: "oi pessoal" });

    expect(callbacks.onPartialTranscript).toHaveBeenCalledWith("oi pes");
    expect(callbacks.onFinalTranscript).toHaveBeenCalledWith("oi pessoal");
    expect(callbacks.onUnavailable).not.toHaveBeenCalled();
  });
});

describe("startLiveTranscription graceful fallback", () => {
  it("falls back to onUnavailable when the token request fails", async () => {
    const callbacks = createCallbacks();

    const session = await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockRejectedValue(new Error("token down")),
      createTranscriber: vi.fn(),
      createAudioContext: vi.fn(),
    });

    expect(callbacks.onUnavailable).toHaveBeenCalledTimes(1);
    expect(() => session.stop()).not.toThrow();
  });

  it("falls back to onUnavailable and closes the socket when connect() rejects", async () => {
    const transcriber = createFakeTranscriber(Promise.reject(new Error("refused")));
    const callbacks = createCallbacks();

    await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockResolvedValue("token-123"),
      createTranscriber: () => transcriber,
      createAudioContext: vi.fn(),
    });

    expect(callbacks.onUnavailable).toHaveBeenCalledTimes(1);
    expect(transcriber.close).toHaveBeenCalledWith(false);
  });

  it("tears down the pipeline and reports unavailable on an unexpected close", async () => {
    const transcriber = createFakeTranscriber();
    const { context, processor, source } = createFakeAudioContext();
    const callbacks = createCallbacks();

    await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockResolvedValue("token-123"),
      createTranscriber: () => transcriber,
      createAudioContext: () => context,
    });

    transcriber.emit("close", 1006, "abnormal closure");

    expect(callbacks.onUnavailable).toHaveBeenCalledTimes(1);
    expect(processor.disconnect).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
  });

  it("never affects the caller when the caller stops the session itself", async () => {
    const transcriber = createFakeTranscriber();
    const { context, processor, source } = createFakeAudioContext();
    const callbacks = createCallbacks();

    const session = await startLiveTranscription({} as MediaStream, callbacks, {
      fetchStreamingToken: vi.fn().mockResolvedValue("token-123"),
      createTranscriber: () => transcriber,
      createAudioContext: () => context,
    });

    session.stop();
    // A close event delivered after we've already stopped must not fire
    // onUnavailable a second time — the caller already knows it stopped.
    transcriber.emit("close", 1000, "normal closure");

    expect(transcriber.close).toHaveBeenCalledWith(false);
    expect(processor.disconnect).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
    expect(callbacks.onUnavailable).not.toHaveBeenCalled();
  });
});
