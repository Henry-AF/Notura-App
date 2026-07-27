"use client";

import { cn } from "@/lib/utils";
import { useAudioLevels } from "./useAudioLevels";

const BAR_HEIGHTS = [
  0.35, 0.6, 0.85, 0.5, 0.75, 0.4, 0.9, 0.65, 0.45, 0.8, 0.55, 0.7,
  0.3, 0.95, 0.6, 0.4, 0.75, 0.5, 0.85, 0.45, 0.65, 0.8, 0.35, 0.9,
];

interface RecordingWaveformProps {
  active: boolean;
  stream?: MediaStream | null;
  className?: string;
}

interface WaveformBarProps {
  height: number;
  active: boolean;
  animated: boolean;
  animationDelay: string;
}

function WaveformBar({ height, active, animated, animationDelay }: WaveformBarProps) {
  return (
    <div
      className={cn(
        "w-[4px] origin-bottom rounded-full transition-opacity duration-300",
        active ? "opacity-100" : "opacity-40"
      )}
      style={{
        height: `${Math.round(height * 52 + 8)}px`,
        background: active
          ? "linear-gradient(to top, #6851FF, #8B7AFF)"
          : "rgb(var(--cn-border))",
        animation: animated ? "recordingWaveBar 0.9s ease-in-out infinite alternate" : "none",
        animationDelay,
      }}
    />
  );
}

export function RecordingWaveform({
  active,
  stream = null,
  className,
}: RecordingWaveformProps) {
  const usingRealLevels = active && stream !== null;
  const levels = useAudioLevels(stream, {
    barCount: BAR_HEIGHTS.length,
    active: usingRealLevels,
  });
  const heights = usingRealLevels ? levels : BAR_HEIGHTS;

  return (
    <div
      className={cn("flex h-20 items-end justify-center gap-[3px]", className)}
      aria-hidden
    >
      {heights.map((height, index) => (
        <WaveformBar
          key={index}
          height={height}
          active={active}
          animated={active && !usingRealLevels}
          animationDelay={`${(index * 41) % 900}ms`}
        />
      ))}
      <style>{`
        @keyframes recordingWaveBar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
