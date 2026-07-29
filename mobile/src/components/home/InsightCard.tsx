import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme/tokens";

export interface InsightCardProps {
  title: string;
  body: string;
}

export function InsightCard({ title, body }: InsightCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.sparkle}>✦</Text>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrowIcon}>⚡</Text>
        <Text style={styles.eyebrow}>INSIGHT DA NOTURA</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 20,
    overflow: "hidden",
  },
  sparkle: {
    position: "absolute",
    top: 14,
    right: 16,
    fontSize: 28,
    color: colors.border,
    opacity: 0.6,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrowIcon: {
    color: "#FFA94D",
    fontSize: 13,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#FFA94D",
  },
  title: {
    fontWeight: "700",
    fontSize: 16,
    color: colors.foreground,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    color: colors.secondaryForeground,
    lineHeight: 20,
  },
});
