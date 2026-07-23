import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MeetingListItem } from "@/lib/meetings/meetings-api";
import { MeetingStatusBadge } from "./MeetingStatusBadge";

interface MeetingListItemViewProps {
  meeting: MeetingListItem;
  onPress: (meeting: MeetingListItem) => void;
}

export function MeetingListItemView({ meeting, onPress }: MeetingListItemViewProps) {
  const displayTitle = meeting.title ?? meeting.clientName ?? "—";

  return (
    <Pressable style={styles.container} onPress={() => onPress(meeting)}>
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {displayTitle}
          </Text>
          {meeting.groupName ? (
            <Text style={styles.group} numberOfLines={1}>
              {meeting.groupName}
            </Text>
          ) : null}
        </View>
        <MeetingStatusBadge status={meeting.status} />
      </View>
      <Text style={styles.date}>{new Date(meeting.createdAt).toLocaleString("pt-BR")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
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
    color: "#0f172a",
  },
  group: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
  },
});
