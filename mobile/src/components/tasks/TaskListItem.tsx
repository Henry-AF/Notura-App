import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme/tokens";
import type { Task } from "@/lib/tasks/tasks-api";

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  alta: "#FF6B6B",
  media: "#FFA94D",
  baixa: "#4ECB71",
};

function getDueDateInfo(dueDate?: string): { label: string; color: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { label: "Atrasado", color: "#FF6B6B" };
  if (diffDays === 0) return { label: "Hoje", color: "#FFA94D" };
  return { label: `${diffDays}d`, color: colors.mutedForeground };
}

interface TaskListItemProps {
  task: Task;
  onPress: () => void;
  onToggleDone: () => void;
}

export function TaskListItem({ task, onPress, onToggleDone }: TaskListItemProps) {
  const isDone = task.status === "completed";
  const dueDateInfo = getDueDateInfo(task.dueDate);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Pressable
        style={styles.checkbox}
        onPress={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
      >
        <View style={[styles.checkboxBox, isDone && styles.checkboxBoxDone]}>
          {isDone ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
      </Pressable>

      <View style={styles.content}>
        <Text style={[styles.title, isDone && styles.titleDone]} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
          {task.meetingSource ? (
            <Text style={styles.meetingChip} numberOfLines={1}>
              {task.meetingSource}
            </Text>
          ) : null}
          {dueDateInfo ? (
            <Text style={[styles.dueDate, { color: dueDateInfo.color }]}>{dueDateInfo.label}</Text>
          ) : null}
          {task.assigneeName ? (
            <Text style={styles.assignee} numberOfLines={1}>
              {task.assigneeName}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  checkbox: {
    paddingTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxDone: {
    backgroundColor: "#4ECB71",
    borderColor: "#4ECB71",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: colors.mutedForeground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  meetingChip: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.primary,
    backgroundColor: "rgba(139,122,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 140,
  },
  dueDate: {
    fontSize: 11,
    fontWeight: "600",
  },
  assignee: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
});
