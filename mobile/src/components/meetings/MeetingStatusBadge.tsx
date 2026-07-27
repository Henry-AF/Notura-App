import { StyleSheet, Text, View } from "react-native";
import { useTheme, type Palette } from "@/theme";
import type { MeetingStatus } from "@/lib/meetings/meetings-api";

interface MeetingStatusBadgeProps {
  status: MeetingStatus;
}

const STATUS_LABELS: Record<MeetingStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  completed: "Concluído",
  failed: "Falhou",
};

/** Hex suffix appended to a 6-digit token to produce a ~15% opacity tint for badge backgrounds. */
const BADGE_TINT_SUFFIX = "26";

function resolveStatusColor(status: MeetingStatus, colors: Palette): string {
  if (status === "pending") return colors.warning;
  if (status === "processing") return colors.processing;
  if (status === "completed") return colors.success;
  return colors.error;
}

export function MeetingStatusBadge({ status }: MeetingStatusBadgeProps) {
  const { colors } = useTheme();
  const statusColor = resolveStatusColor(status, colors);

  return (
    <View style={[styles.badge, { backgroundColor: `${statusColor}${BADGE_TINT_SUFFIX}` }]}>
      <Text style={[styles.label, { color: statusColor }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
