// Full-width horizontal equalizer for the recording screen (NOT-136 layout).
// Bar pattern mirrors the web app's `RecordingWaveform` (`BAR_HEIGHTS`) so the
// two platforms read as the same visual language.
import { Animated, StyleSheet, View } from 'react-native';
import { useReactiveBars, type ReactiveBarsRange } from './useReactiveBars';
import { palette } from '@/theme';

const BAR_MULTIPLIERS = [
  0.35, 0.6, 0.85, 0.5, 0.75, 0.4, 0.9, 0.65, 0.45, 0.8, 0.55, 0.7, 0.3, 0.95, 0.6, 0.4, 0.75, 0.5,
  0.85, 0.45, 0.65, 0.8, 0.35, 0.9,
];
const RANGE: ReactiveBarsRange = { minHeight: 4, maxHeight: 40 };
const BAR_COLOR = palette.dark.primaryLight;

interface RecordingEqualizerProps {
  amplitude: number | null;
  active: boolean;
}

export function RecordingEqualizer({ amplitude, active }: RecordingEqualizerProps) {
  const barHeights = useReactiveBars(BAR_MULTIPLIERS, RANGE, amplitude, active);

  return (
    <View style={styles.row}>
      {barHeights.map((height, index) => (
        <Animated.View key={index} style={[styles.bar, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: RANGE.maxHeight,
    width: '100%',
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: BAR_COLOR,
  },
});
