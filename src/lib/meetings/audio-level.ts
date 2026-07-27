const DEFAULT_BAR_COUNT = 24;
const DEFAULT_FFT_SIZE = 256;

type LevelAudioContext = Pick<
  AudioContext,
  "close" | "createAnalyser" | "createMediaStreamSource"
>;

interface AudioLevelAnalyser {
  getLevels(): number[];
  dispose(): void;
}

export function bucketizeFrequencyData(
  data: Uint8Array,
  barCount: number
): number[] {
  if (barCount <= 0 || data.length === 0) {
    return new Array(Math.max(barCount, 0)).fill(0);
  }

  const bucketSize = data.length / barCount;

  return Array.from({ length: barCount }, (_, bar) => {
    const start = Math.floor(bar * bucketSize);
    const end = Math.max(start + 1, Math.floor((bar + 1) * bucketSize));
    const sum = sumRange(data, start, end);
    const average = sum / (end - start);

    return clamp01(average / 255);
  });
}

export function smoothLevels(
  previous: number[],
  next: number[],
  smoothing: number
): number[] {
  const clampedSmoothing = clamp01(smoothing);

  return next.map((value, index) => {
    const previousValue = previous[index];
    return previousValue + (value - previousValue) * clampedSmoothing;
  });
}

export function createAudioLevelAnalyser(
  stream: MediaStream,
  options: { barCount?: number } = {}
): AudioLevelAnalyser {
  const barCount = options.barCount ?? DEFAULT_BAR_COUNT;
  const audioContext = createBrowserAudioContext();
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = DEFAULT_FFT_SIZE;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyserNode);

  const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
  let hasDisposed = false;

  return {
    getLevels(): number[] {
      analyserNode.getByteFrequencyData(frequencyData);
      return bucketizeFrequencyData(frequencyData, barCount);
    },
    dispose(): void {
      if (hasDisposed) {
        return;
      }

      hasDisposed = true;
      source.disconnect();
      void audioContext.close();
    },
  };
}

function sumRange(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    sum += data[index];
  }
  return sum;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createBrowserAudioContext(): LevelAudioContext {
  if (typeof window === "undefined") {
    throw new Error("Seu navegador não suporta análise de áudio nesta página.");
  }

  const browserWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    window.AudioContext ?? browserWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("Seu navegador não suporta análise de áudio nesta página.");
  }

  return new AudioContextConstructor();
}
