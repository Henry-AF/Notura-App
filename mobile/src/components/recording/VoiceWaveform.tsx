// Voice-reactive waveform for the recording screen (NOT-121). Built on RN
// core `Animated` only — no reanimated/svg/skia. When `amplitude` is `null`
// (metering unavailable, see expo/expo#37241) this intentionally does NOT
// fake voice-reactive movement; it falls back to an honest idle "listening"
// pulse instead, per ARCHITECTURE.md's stance against safe-looking code
// that lies about what it's measuring.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const BAR_MULTIPLIERS = [0.5, 0.75, 1, 0.65, 1, 0.75, 0.5];
const MIN_BAR_HEIGHT = 6;
const MAX_BAR_HEIGHT = 32;
const REACTIVE_DURATION_MS = 100;
const IDLE_PULSE_DURATION_MS = 900;
const EASING = Easing.bezier(0.3, 0, 0.1, 1);
const ACCENT_PRIMARY = '#5E4CEB';

interface VoiceWaveformProps {
  amplitude: number | null;
  active: boolean;
}

export function VoiceWaveform({ amplitude, active }: VoiceWaveformProps) {
  const barHeights = useBarHeights();

  useReactiveBars(barHeights, amplitude, active);
  useIdleBreathing(barHeights, active && amplitude === null);
  useRestingBars(barHeights, !active);

  return (
    <View style={styles.row}>
      {barHeights.map((height, index) => (
        <Animated.View key={index} style={[styles.bar, { height }]} />
      ))}
    </View>
  );
}

function useBarHeights(): Animated.Value[] {
  const ref = useRef<Animated.Value[] | null>(null);
  if (!ref.current) {
    ref.current = BAR_MULTIPLIERS.map(() => new Animated.Value(MIN_BAR_HEIGHT));
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
function useReactiveBars(barHeights: Animated.Value[], amplitude: number | null, active: boolean) {
  useEffect(() => {
    if (!active || amplitude === null) return;

    const targets = BAR_MULTIPLIERS.map(
      (multiplier) => MIN_BAR_HEIGHT + amplitude * multiplier * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)
    );
    animateTo(barHeights, targets, REACTIVE_DURATION_MS).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitude, active]);
}

// Honest "listening" state: all bars breathe together at a low, synchronized
// level so it reads as distinct from real voice-reactive movement.
function useIdleBreathing(barHeights: Animated.Value[], shouldBreathe: boolean) {
  useEffect(() => {
    if (!shouldBreathe) return;

    const idleHeight = MIN_BAR_HEIGHT + 0.2 * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT);
    const pulse = Animated.loop(
      Animated.sequence([
        animateTo(barHeights, BAR_MULTIPLIERS.map(() => idleHeight), IDLE_PULSE_DURATION_MS),
        animateTo(barHeights, BAR_MULTIPLIERS.map(() => MIN_BAR_HEIGHT), IDLE_PULSE_DURATION_MS),
      ])
    );
    pulse.start();
    return () => pulse.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldBreathe]);
}

function useRestingBars(barHeights: Animated.Value[], isResting: boolean) {
  useEffect(() => {
    if (!isResting) return;
    animateTo(barHeights, BAR_MULTIPLIERS.map(() => MIN_BAR_HEIGHT), REACTIVE_DURATION_MS).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResting]);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: MAX_BAR_HEIGHT,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: ACCENT_PRIMARY,
  },
});
