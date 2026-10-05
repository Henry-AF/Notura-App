import { StyleSheet, View } from "react-native";
import { palette } from "@/theme/tokens";
import { ThemedText } from "@/components/ui/ThemedText";

// Bar heights follow the waveform glyph of the web logo (src/components/logo.tsx).
const BAR_HEIGHTS = [8, 18, 30, 18, 8] as const;

/** Waveform icon + "Notura" wordmark, centered. */
export function AuthLogo() {
  const brand = palette.light.primary;

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Notura">
      <View style={styles.bars}>
        {BAR_HEIGHTS.map((height, index) => (
          <View key={index} style={[styles.bar, { height, backgroundColor: brand }]} />
        ))}
      </View>
      <ThemedText variant="title2" color={brand} style={styles.wordmark}>
        Notura
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bars: { flexDirection: "row", alignItems: "center", gap: 3, height: 30 },
  bar: { width: 4, borderRadius: 2 },
  wordmark: { fontSize: 28, lineHeight: 34 },
});
