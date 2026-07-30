// Shared bar-animation logic behind the recording screen's voice-reactive
// visuals (NOT-121/NOT-136): the full-width equalizer and the audio sphere's
// inner glow both animate a row of `Animated.Value`s the same way, just with
// different bar counts/sizes. Built on RN core `Animated` only — no
// reanimated/svg/skia.
//
// When `amplitude` is `null` (metering unavailable, see expo/expo#37241)
// this intentionally does NOT fake voice-reactive movement; it falls back to
// an honest idle "listening" pulse instead, per ARCHITECTURE.md's stance
// against safe-looking code that lies about what it's measuring.

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

const REACTIVE_DURATION_MS = 100;
const IDLE_PULSE_DURATION_MS = 900;
const EASING = Easing.bezier(0.3, 0, 0.1, 1);

export interface ReactiveBarsRange {
  minHeight: number;
  maxHeight: number;
}

/**
 * Animates one `Animated.Value` per entry in `multipliers` toward heights
 * derived from `amplitude`, honestly falling back to an idle breathing pulse
 * (or resting flat) when the caller isn't `active` or has no real reading.
 */
export function useReactiveBars(
  multipliers: readonly number[],
  range: ReactiveBarsRange,
  amplitude: number | null,
  active: boolean
): Animated.Value[] {
  const barHeights = useBarHeights(multipliers, range.minHeight);

  useAmplitudeReaction(barHeights, multipliers, range, amplitude, active);
  useIdleBreathing(barHeights, multipliers, range, active && amplitude === null);
  useRestingBars(barHeights, multipliers, range.minHeight, !active);

  return barHeights;
}

function useBarHeights(multipliers: readonly number[], minHeight: number): Animated.Value[] {
  const ref = useRef<Animated.Value[] | null>(null);
  if (!ref.current) {
    ref.current = multipliers.map(() => new Animated.Value(minHeight));
  }
  return ref.current;
}

function animateTo(barHeights: Animated.Value[], targets: number[], duration: number) {
  return Animated.parallel(
    barHeights.map((value, index) =>
      Animated.timing(value, {
        toValue: targets[index],
        duration,
        easing: EASING,
        useNativeDriver: false,
      })
    )
  );
}

// Each bar reacts to the same amplitude reading but with its own multiplier
// so the row doesn't move in perfect lockstep, mirroring natural voice bars.
function useAmplitudeReaction(
  barHeights: Animated.Value[],
  multipliers: readonly number[],
  range: ReactiveBarsRange,
  amplitude: number | null,
  active: boolean
) {
  useEffect(() => {
    if (!active || amplitude === null) return;

    const targets = multipliers.map(
      (multiplier) => range.minHeight + amplitude * multiplier * (range.maxHeight - range.minHeight)
    );
    animateTo(barHeights, targets, REACTIVE_DURATION_MS).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitude, active]);
}

// Honest "listening" state: all bars breathe together at a low, synchronized
// level so it reads as distinct from real voice-reactive movement.
function useIdleBreathing(
  barHeights: Animated.Value[],
  multipliers: readonly number[],
  range: ReactiveBarsRange,
  shouldBreathe: boolean
) {
  useEffect(() => {
    if (!shouldBreathe) return;

    const idleHeight = range.minHeight + 0.2 * (range.maxHeight - range.minHeight);
    const pulse = Animated.loop(
      Animated.sequence([
        animateTo(barHeights, multipliers.map(() => idleHeight), IDLE_PULSE_DURATION_MS),
        animateTo(barHeights, multipliers.map(() => range.minHeight), IDLE_PULSE_DURATION_MS),
      ])
    );
    pulse.start();
    return () => pulse.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldBreathe]);
}

function useRestingBars(
  barHeights: Animated.Value[],
  multipliers: readonly number[],
  minHeight: number,
  isResting: boolean
) {
  useEffect(() => {
    if (!isResting) return;
    animateTo(barHeights, multipliers.map(() => minHeight), REACTIVE_DURATION_MS).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResting]);
}
