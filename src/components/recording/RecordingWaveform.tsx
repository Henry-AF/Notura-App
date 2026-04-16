"use client";

import { cn } from "@/lib/utils";

const BAR_HEIGHTS = [
  0.35, 0.6, 0.85, 0.5, 0.75, 0.4, 0.9, 0.65, 0.45, 0.8, 0.55, 0.7,
  0.3, 0.95, 0.6, 0.4, 0.75, 0.5, 0.85, 0.45, 0.65, 0.8, 0.35, 0.9,
];

interface RecordingWaveformProps {
  active: boolean;
  className?: string;
}

export function RecordingWaveform({
  active,
  className,
}: RecordingWaveformProps) {
  return (
    <div
      className={cn("flex h-20 items-end justify-center gap-[3px]", className)}
      aria-hidden
    >
      {BAR_HEIGHTS.map((height, index) => (
        <div
          key={index}
          className={cn(
            "w-[4px] origin-bottom rounded-full transition-opacity duration-300",
            active ? "opacity-100" : "opacity-40"
          )}
          style={{
            height: `${Math.round(height * 52 + 8)}px`,
            background: active
              ? "linear-gradient(to top, #6851FF, #8B7AFF)"
              : "rgb(var(--cn-border))",
            animation: active ? "recordingWaveBar 0.9s ease-in-out infinite alternate" : "none",
            animationDelay: `${(index * 41) % 900}ms`,
          }}
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
