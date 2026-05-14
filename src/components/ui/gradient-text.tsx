"use client";

import * as React from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

type GradientDirection = "horizontal" | "vertical" | "diagonal";

export interface GradientTextProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  colors?: string[];
  animationSpeed?: number;
  direction?: GradientDirection;
  pauseOnHover?: boolean;
  showBorder?: boolean;
  yoyo?: boolean;
}

export default function GradientText({
  children,
  className,
  colors = ["#5227FF", "#FF9FFC", "#B497CF"],
  animationSpeed = 8,
  direction = "horizontal",
  pauseOnHover = false,
  showBorder = false,
  yoyo = true,
  onMouseEnter,
  onMouseLeave,
  ...props
}: GradientTextProps) {
  const [isPaused, setIsPaused] = React.useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = React.useRef(0);
  const lastTimeRef = React.useRef<number | null>(null);

  const animationDuration = animationSpeed * 1000;

  useAnimationFrame((time) => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;

      if (cycleTime < animationDuration) {
        progress.set((cycleTime / animationDuration) * 100);
      } else {
        progress.set(
          100 - ((cycleTime - animationDuration) / animationDuration) * 100
        );
      }
      return;
    }

    progress.set((elapsedRef.current / animationDuration) * 100);
  });

  React.useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, progress, yoyo]);

  const backgroundPosition = useTransform(progress, (value) => {
    if (direction === "horizontal") return `${value}% 50%`;
    if (direction === "vertical") return `50% ${value}%`;
    return `${value}% 50%`;
  });

  const gradientAngle =
    direction === "horizontal"
      ? "to right"
      : direction === "vertical"
        ? "to bottom"
        : "to bottom right";
  const gradientColors = [...colors, colors[0]].join(", ");
  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize:
      direction === "horizontal"
        ? "300% 100%"
        : direction === "vertical"
          ? "100% 300%"
          : "300% 300%",
    backgroundRepeat: "repeat",
  };

  return (
    <motion.span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-[1.25rem]",
        showBorder && "px-3 py-1.5",
        className
      )}
      onMouseEnter={(event: React.MouseEvent<HTMLSpanElement>) => {
        if (pauseOnHover) setIsPaused(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event: React.MouseEvent<HTMLSpanElement>) => {
        if (pauseOnHover) setIsPaused(false);
        onMouseLeave?.(event);
      }}
      {...props}
    >
      {showBorder ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ ...gradientStyle, backgroundPosition }}
        >
          <span className="absolute left-1/2 top-1/2 h-[calc(100%-2px)] w-[calc(100%-2px)] -translate-x-1/2 -translate-y-1/2 rounded-[inherit] bg-background" />
        </motion.span>
      ) : null}
      <motion.span
        className="relative z-[1] inline-block bg-clip-text text-transparent [-webkit-background-clip:text]"
        style={{ ...gradientStyle, backgroundPosition }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}