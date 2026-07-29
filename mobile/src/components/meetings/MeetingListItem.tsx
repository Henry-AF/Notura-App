import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import type { MeetingListItem } from "@/lib/meetings/meetings-api";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

interface MeetingListItemViewProps {
  meeting: MeetingListItem;
  onPress: (meeting: MeetingListItem) => void;
}

export function MeetingListItemView({ meeting, onPress }: MeetingListItemViewProps) {
  const { colors } = useTheme();
  const displayTitle = meeting.title ?? meeting.clientName ?? "—";

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={() => onPress(meeting)}
    >
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {displayTitle}
          </Text>
          {meeting.groupName ? (
            <Text style={[styles.group, { color: colors.mutedForeground }]} numberOfLines={1}>
              {meeting.groupName}
            </Text>
          ) : null}
        </View>
        <MeetingStatusBadge status={meeting.status} />
      </View>
      <Text style={[styles.date, { color: colors.mutedForeground }]}>
        {new Date(meeting.createdAt).toLocaleString("pt-BR")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  group: {
    fontSize: 13,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    marginTop: 8,
  },
});
