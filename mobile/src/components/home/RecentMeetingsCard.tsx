import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, statusColors } from "@/lib/theme/tokens";
import type { DashboardMeeting } from "@/lib/dashboard/dashboard-api";

const STATUS_LABELS: Record<DashboardMeeting["status"], string> = {
  completed: "Concluído",
  processing: "Processando",
  failed: "Falhou",
};

interface RecentMeetingsCardProps {
  meetings: DashboardMeeting[];
  onViewAll: () => void;
  onRetry: (id: string) => void;
  onViewProcessing: (id: string) => void;
  onRowPress: (id: string) => void;
}

export function RecentMeetingsCard({
  meetings,
  onViewAll,
  onRetry,
  onViewProcessing,
  onRowPress,
}: RecentMeetingsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Reuniões Recentes</Text>
        <Pressable onPress={onViewAll}>
          <Text style={styles.viewAll}>Ver tudo →</Text>
        </Pressable>
      </View>

      {meetings.length === 0 ? (
        <Text style={styles.empty}>Você ainda não possui reuniões.</Text>
      ) : (
        meetings.map((meeting, index) => {
          const status = statusColors[meeting.status];
          const isLast = index === meetings.length - 1;
          return (
            <Pressable
              key={meeting.id}
              style={[styles.row, !isLast && styles.rowBorder]}
              onPress={() => onRowPress(meeting.id)}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {meeting.title}
                </Text>
                {meeting.groupName ? (
                  <Text style={styles.rowGroup} numberOfLines={1}>
                    {meeting.groupName}
                  </Text>
                ) : null}
                <View style={styles.rowMeta}>
                  <Text style={styles.rowDate}>{meeting.date}</Text>
                  <View style={[styles.badge, { backgroundColor: status.background }]}>
                    <View style={[styles.badgeDot, { backgroundColor: status.text }]} />
                    <Text style={[styles.badgeText, { color: status.text }]}>
                      {STATUS_LABELS[meeting.status]}
                    </Text>
                  </View>
                </View>
              </View>

              {meeting.status === "processing" ? (
                <Pressable
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    onViewProcessing(meeting.id);
                  }}
                >
                  <Text style={styles.actionIcon}>✨</Text>
                </Pressable>
              ) : null}
              {meeting.status === "failed" ? (
                <Pressable
                  style={[styles.actionButton, styles.actionButtonFailed]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onRetry(meeting.id);
                  }}
                >
                  <Text style={styles.actionIcon}>↻</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.foreground,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  empty: {
    textAlign: "center",
    color: colors.mutedForeground,
    paddingVertical: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  rowGroup: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  rowDate: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card2,
  },
  actionButtonFailed: {
    backgroundColor: statusColors.failed.background,
  },
  actionIcon: {
    fontSize: 14,
    color: colors.foreground,
  },
});
