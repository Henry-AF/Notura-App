"use client";

import { useEffect, useRef, useState } from "react";
import {
  createAudioLevelAnalyser,
  smoothLevels,
} from "@/lib/meetings/audio-level";

const DEFAULT_BAR_COUNT = 24;
const SMOOTHING = 0.35;

interface UseAudioLevelsOptions {
  barCount?: number;
  active?: boolean;
}

export function useAudioLevels(
  stream: MediaStream | null,
  options: UseAudioLevelsOptions = {}
): number[] {
  const barCount = options.barCount ?? DEFAULT_BAR_COUNT;
  const active = options.active ?? true;
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0)
  );
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    if (!stream || !active) {
      setLevels(Array.from({ length: barCount }, () => 0));
      return;
    }

    const analyser = createAudioLevelAnalyser(stream, { barCount });
    let frameId: number;

    const tick = () => {
      const nextLevels = smoothLevels(
        levelsRef.current,
        analyser.getLevels(),
        SMOOTHING
      );
      levelsRef.current = nextLevels;
      setLevels(nextLevels);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      analyser.dispose();
    };
  }, [active, barCount, stream]);

  return levels;
}
