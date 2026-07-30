import { Pressable, StyleSheet, Text, View } from "react-native";

export interface QuickActionCardProps {
  label: string;
  color: string;
  onPress: () => void;
}

// NOTE: web uses an animated WebGL gradient background (`Grainient`) here.
// There's no RN-portable equivalent in the mobile app's current
// dependencies, so this renders a solid brand-color tile instead — same
// labels/destinations as web, simplified visual treatment.
export function QuickActionCard({ label, color, onPress }: QuickActionCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <Text style={styles.label} numberOfLines={3}>
          {label}
        </Text>
        <Text style={styles.arrow}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 108,
    borderRadius: 12,
    padding: 12,
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cardPressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    color: "#ffffff",
  },
  arrow: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
});
