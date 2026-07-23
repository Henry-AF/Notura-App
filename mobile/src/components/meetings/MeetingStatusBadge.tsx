import { StyleSheet, Text, View } from "react-native";
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

const STATUS_COLORS: Record<MeetingStatus, { background: string; text: string }> = {
  pending: { background: "#fef3c7", text: "#d97706" },
  processing: { background: "#dbeafe", text: "#2563eb" },
  completed: { background: "#dcfce7", text: "#16a34a" },
  failed: { background: "#fee2e2", text: "#dc2626" },
};

export function MeetingStatusBadge({ status }: MeetingStatusBadgeProps) {
  const colors = STATUS_COLORS[status];

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>{STATUS_LABELS[status]}</Text>
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
