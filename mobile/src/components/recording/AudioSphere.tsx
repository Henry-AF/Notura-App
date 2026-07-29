// Focal element of the recording screen (NOT-136 layout / NOT-121 real
// reactivity): a gradient sphere with a glowing waveform inside it, both
// driven by the same real microphone amplitude as `RecordingEqualizer`. When
// `amplitude` is `null` it breathes gently instead of faking reactivity — see
// `useReactiveBars` for why.
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReactiveBars, type ReactiveBarsRange } from './useReactiveBars';
import { palette } from '@/theme';

const SPHERE_SIZE = 220;
const GLOW_MULTIPLIERS = [0.55, 0.8, 1, 0.8, 0.55];
const GLOW_RANGE: ReactiveBarsRange = { minHeight: 10, maxHeight: 64 };
const GLOW_COLOR = 'rgba(255, 255, 255, 0.85)';
const SCALE_MIN = 1;
const SCALE_MAX = 1.06;
const SCALE_DURATION_MS = 120;
const IDLE_SCALE_DURATION_MS = 1400;

interface AudioSphereProps {
  amplitude: number | null;
  active: boolean;
}

export function AudioSphere({ amplitude, active }: AudioSphereProps) {
  const glowBars = useReactiveBars(GLOW_MULTIPLIERS, GLOW_RANGE, amplitude, active);
  const scale = useSphereScale(amplitude, active);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <LinearGradient
        colors={[palette.dark.primaryDark, palette.dark.primary]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.sphere}
      >
        <View style={styles.glowRow}>
          {glowBars.map((height, index) => (
            <Animated.View key={index} style={[styles.glowBar, { height }]} />
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// Subtle whole-sphere pulse layered on top of the inner glow bars, driven by
// the same amplitude signal, so the focal element itself feels alive.
function useSphereScale(amplitude: number | null, active: boolean): Animated.Value {
  const scale = useRef(new Animated.Value(SCALE_MIN)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(scale, {
        toValue: SCALE_MIN,
        duration: SCALE_DURATION_MS,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (amplitude === null) {
      const idleTarget = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * 0.3;
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: idleTarget,
            duration: IDLE_SCALE_DURATION_MS,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: SCALE_MIN,
            duration: IDLE_SCALE_DURATION_MS,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }

    const target = SCALE_MIN + amplitude * (SCALE_MAX - SCALE_MIN);
    Animated.timing(scale, {
      toValue: target,
      duration: SCALE_DURATION_MS,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitude, active]);

  return scale;
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 12,
  },
  sphere: {
    width: SPHERE_SIZE,
    height: SPHERE_SIZE,
    borderRadius: SPHERE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: GLOW_RANGE.maxHeight,
  },
  glowBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: GLOW_COLOR,
  },
});
